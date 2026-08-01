# Kiến trúc Backend V2

## 1. Mục tiêu

V2 chuyển dữ liệu nghiệp vụ từ MongoDB sang PostgreSQL, giữ API contract gần với V1 và bổ sung transaction core để tập trung hóa mọi thay đổi số dư.

Trong thời gian phát triển:

- V1 tiếp tục phục vụ production bằng MongoDB.
- V2 chỉ có shared deployment trên staging bằng PostgreSQL staging riêng trước cutover; local/dev có thể bật cùng feature gate để phát triển và kiểm thử. `DEPLOYMENT_ENV=production` luôn cấm mount V2 theo DEC-064.
- Không dual-write giữa MongoDB và PostgreSQL.
- Cutover chỉ diễn ra sau khi migration rehearsal, đối soát và kiểm thử V2 đạt yêu cầu.

## 2. API versioning

Các endpoint V2 về cơ bản tương ứng với V1:

```text
/api/v1/accounts       /api/v2/accounts
/api/v1/transactions   /api/v2/transactions
```

Trong giai đoạn chuyển tiếp, URL không version hiện tại có thể tiếp tục trỏ tới V1:

```js
app.use('/', v1Routes)
app.use('/api/v1', v1Routes)
app.use('/api/v2', v2Routes)
```

V1 và V2 chỉ chia sẻ API contract khi phù hợp; không chia sẻ implementation phụ thuộc database.

```text
V1: Route -> Controller -> Service -> MongoDB Model

V2: Route -> Controller -> Service -> Repository
                              \-> Transaction Core
                                      -> Prisma/PostgreSQL
```

## 3. Cấu trúc source mục tiêu

```text
src/
├── api/
│   ├── v1/
│   │   ├── routes/
│   │   ├── controllers/
│   │   └── index.js
│   └── v2/
│       ├── routes/
│       ├── controllers/
│       ├── validations/
│       ├── mappers/
│       └── index.js
├── v1/
│   ├── services/
│   ├── models/
│   └── infrastructure/mongodb/
├── v2/
│   ├── modules/
│   ├── core/
│   └── infrastructure/
├── shared/
├── config/
├── sockets/
└── server.js
```

Cấu trúc này là mục tiêu cuối; việc di chuyển V1 phải thực hiện từng bước, không tạo một commit refactor lớn chỉ để đổi vị trí file.

## 4. Trách nhiệm từng phần

### `src/api/v1`

- Chứa routes và controllers V1.
- Giữ API contract và hành vi production hiện tại.
- Có thể re-export code cũ trong giai đoạn đầu để giảm rủi ro refactor.

### `src/api/v2`

- Khai báo HTTP method, URL và middleware V2.
- Controller chuyển request thành input cho service và định dạng HTTP response.
- `validations` chứa Joi request schemas; `mappers` định dạng API response/compatibility contract.
- Không gọi Prisma, Redis hoặc cập nhật số dư trực tiếp.
- Không chứa business rule; actor lấy từ authentication context, không tin `userId/ownerId` trong body.

### `src/v1`

- Khoanh vùng services, models và MongoDB infrastructure cũ.
- V1 ở trạng thái feature freeze; chỉ sửa lỗi cần thiết.

### `src/v2/modules`

Tổ chức hybrid theo domain cho business/application layer. Routes/controllers không đặt trong module V2, ví dụ:

```text
modules/accounts/
├── services/
│   ├── create-account.service.js
│   └── close-account.service.js
├── repositories/
├── validators/
├── mappers/
└── policies/
```

- Service xử lý nghiệp vụ của endpoint, quyền truy cập và điều phối core/repository.
- Repository đóng gói thao tác dữ liệu PostgreSQL qua Prisma.
- Validator/policy ở đây chỉ là business/domain rule, không nhận Express request.
- Mapper ở đây chỉ phục vụ domain/persistence; HTTP response mapper nằm trong `src/api/v2`.
- Module không import Express hoặc sử dụng `req/res/next`/HTTP status code.

Không sử dụng tầng có tên `use-case`; V2 tiếp tục dùng `service` để nhất quán với V1.

### `src/v2/core`

Chứa quy tắc tài chính dùng chung:

```text
core/
├── ledger/
├── financial-transactions/
├── snapshots/
├── idempotency/
└── reconciliation/
```

Core là nơi duy nhất có quyền tạo ledger postings và cập nhật cached balance.

### `src/v2/infrastructure`

```text
infrastructure/
├── database/
├── cache/
├── jobs/
└── messaging/
```

- `database`: Prisma client, PostgreSQL transaction, locking và raw/typed SQL.
- `cache`: Redis client, cache key, TTL và invalidation.
- `jobs`: scheduled/background jobs.
- `messaging`: outbox processor và event publisher.

`jobs` cung cấp `JobScheduler` abstraction. Agenda 5/MongoDB chỉ là adapter ban đầu; job handler gọi V2 service/core và service/core không import Agenda. Chi tiết tại `job-scheduler.md`.

Financial repositories nhận explicit `TransactionContext` từ transaction core; không dùng global Prisma client trong financial write path. Chi tiết tại `transaction-runtime.md`.

### `src/shared`

Chỉ chứa thành phần trung lập với API version và database như error base class, JWT helpers hoặc security utilities. Không đặt MongoDB model, Prisma repository hoặc hàm cập nhật balance trong `shared`.

## 5. Ví dụ luồng tạo chi tiêu

```text
POST /api/v2/transactions/expense
  -> v2 route: auth + Joi validation
  -> v2 controller: tạo input từ request/JWT
  -> transactionService.createExpense
  -> kiểm tra quyền account/category/financial space
  -> financialTransactionCore.post
  -> PostgreSQL transaction + row locks
  -> ledger + cached balance + immutable business snapshot + outbox
  -> commit
  -> mapper trả response tương thích contract
```

`transactionService` không được gọi `accountRepository.decreaseBalance()` trực tiếp.

Periodic balance snapshot là checkpoint đối soát chạy riêng sau commit; không nằm trong atomic write path trên. Sai lệch từ migration/reconciliation/snapshot/jobs/outbox được lưu qua module `admin-operations` để admin kiểm tra và xử lý có audit.

## 6. Cô lập staging

- PostgreSQL staging và Redis namespace staging phải tách production.
- Job, email, notification và socket staging không được tạo side effect production.
- V2 được bật bằng cấu hình môi trường, dự kiến `ENABLE_API_V2`.
- Feature flags theo module dùng để rollout staging/read/admin và làm kill switch. Financial write không được chia giữa V1 và V2; tại một thời điểm chỉ có một write authority.
- Production V1 là nguồn sự thật cho đến maintenance window.
