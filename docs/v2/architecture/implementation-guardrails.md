# Implementation Guardrails V2

Tài liệu này chốt các ranh giới kỹ thuật bắt buộc khi hiện thực V2. Chi tiết bảng vẫn được hoàn thiện sau inventory, nhưng không được đi ngược các quy tắc dưới đây.

## 1. Định danh

- Entity nghiệp vụ dùng `id BIGINT GENERATED ALWAYS AS IDENTITY` làm khóa nội bộ và foreign key.
- Entity xuất hiện qua API dùng thêm `public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE`.
- Dữ liệu chuyển từ V1 dùng `legacy_mongo_id CHAR(24) NULL UNIQUE` để truy vết và chạy migration idempotent.
- API, URL, log gửi ra client và event công khai chỉ dùng `public_id`; không serialize internal ID.
- Join table hoặc bảng thuần kỹ thuật không cần public UUID nếu không được tham chiếu từ bên ngoài.
- UUID phải do PostgreSQL tạo; sequence/identity và UUID không được client cung cấp.

Thiết kế này giữ ưu điểm join/index gọn của BIGINT, đồng thời không biến khóa tuần tự thành định danh công khai. PostgreSQL quản lý identity tương tự auto-increment; Prisma biểu diễn bằng `BigInt @id @default(autoincrement())` và UUID bằng `String @db.Uuid @default(dbgenerated("gen_random_uuid()"))`.

## 2. Tiền và thời gian

- V2 giai đoạn đầu chỉ hỗ trợ `VND`; amount/balance lưu `BIGINT`, đơn vị 1 VND.
- JSON API serialize mọi `BigInt` tiền thành chuỗi thập phân, ví dụ `"125000"`; request cũng không đi qua JavaScript `Number` trước khi parse.
- Lãi suất dùng decimal arithmetic theo `interest-rate-rules.md`, không dùng floating point.
- Mọi timestamp lưu và tính theo UTC. Business date, khóa idempotency theo ngày và phép đếm ngày đều lấy UTC.
- Lãi không kỳ hạn giữ tương thích V1: tính cả ngày bắt đầu và ngày kết thúc. Kỳ hạn tháng giữ công thức tháng hiện tại cho đến khi có quyết định nghiệp vụ khác.

## 3. Ledger và transaction boundary

Trạng thái financial transaction tối thiểu:

```text
DRAFT -> POSTED
DRAFT -> FAILED
POSTED -> REVERSED (thông qua transaction đảo mới)
```

- Chỉ transaction core được tạo postings và cập nhật cached balance.
- Repository không cung cấp hàm post một ledger entry độc lập.
- Một transaction chỉ chuyển `DRAFT -> POSTED` nếu database xác nhận tổng signed postings bằng 0 và có đủ các constraint nghiệp vụ.
- Enforcement cuối cùng phải ở database boundary, ưu tiên stored function hoặc deferred constraint trigger; application validation chỉ là lớp báo lỗi sớm.
- Entry đã post là bất biến; sửa sai bằng reversal/adjustment transaction có liên kết và audit.
- Business snapshot JSONB gắn với giao dịch là bằng chứng bất biến tại thời điểm post; periodic balance snapshot là checkpoint dẫn xuất và là khái niệm khác.

## 4. Locking, isolation và retry

- Mặc định dùng `READ COMMITTED` kết hợp `SELECT ... FOR UPDATE` cho các account bị tác động.
- Khóa account theo thứ tự internal ID tăng dần để giảm deadlock.
- Cấu hình `lock_timeout`, `statement_timeout` và transaction timeout phù hợp; không giữ transaction khi gọi email, socket hoặc dịch vụ ngoài.
- Chỉ retry hữu hạn các lỗi có thể thử lại như SQLSTATE `40001` và `40P01`, dùng exponential backoff có jitter.
- Mỗi lần retry phải chạy lại toàn transaction, không tái sử dụng dữ liệu balance đã đọc từ lần trước.
- Nếu một nghiệp vụ không thể chứng minh an toàn ở `READ COMMITTED`, tài liệu module phải nâng isolation và bổ sung concurrency test tương ứng.

## 5. Idempotency

Bản ghi tối thiểu gồm:

```text
scope, idempotency_key, request_hash, actor_id
status, resource_type, resource_public_id
response_code, response_body, expires_at
created_at, completed_at
```

- Unique `(scope, idempotency_key)`.
- Cùng key và cùng request hash trả lại kết quả đã lưu; cùng key nhưng payload khác trả conflict.
- Record `IN_PROGRESS` phải có timeout/recovery rule; không được tự ý post lại khi chưa xác định transaction trước đã commit hay chưa.
- Financial scheduled jobs dùng key ổn định theo loại job và kỳ nghiệp vụ.

## 6. Transactional outbox

Outbox tối thiểu lưu `event_id`, aggregate, event type/version, payload, status, attempts, available/processed timestamps và last error. Business write và outbox insert phải commit cùng transaction.

Delivery là at-least-once, vì vậy consumer phải deduplicate theo `event_id`. Retry quá ngưỡng chuyển dead-letter/requires-review và tạo discrepancy case; không được đánh dấu thành công trước khi side effect hoàn tất.

## 7. Balance policy kế thừa V1

| Loại account | Quy tắc V2 ban đầu |
|---|---|
| Account thông thường | Có thể migrate/open với số dư âm như dữ liệu V1; outgoing operation mới không được làm số dư xuống dưới 0 |
| Saving/accumulation | Không cho số dư âm |
| Loan/system ledger account | Theo normal-side và invariant riêng trong posting template |

Mỗi transaction type phải có posting template, account roles và balance rule rõ ràng trước khi triển khai.

## 8. Tổ chức module hybrid

Giữ tên `service`, không thêm tầng `use-case`. Module nhỏ có thể phẳng; module phức tạp tách theo trách nhiệm:

```text
src/v2/modules/accounts/
├── accounts.routes.js
├── accounts.controller.js
├── services/
│   ├── create-account.service.js
│   └── close-account.service.js
├── repositories/
├── validators/
├── mappers/
└── policies/
```

Transaction core, admin operations và shared infrastructure là phần mới nằm hoàn toàn dưới `src/v2/`; không trộn vào thiết kế V1.

## 9. Retention khởi điểm

- Ledger, financial transactions, reversals và business/periodic snapshots: giữ lâu dài.
- Admin audit và discrepancy cases: giữ lâu dài.
- Idempotency record hoàn tất: tối thiểu 90 ngày; key của nghiệp vụ định kỳ giữ đủ vòng đời nghiệp vụ.
- Outbox đã xử lý: 90 ngày; failed/dead-letter giữ đến khi xử lý xong và tối thiểu thêm 180 ngày.
- Snapshot run logs: 180 ngày.
- Application logs: 30 ngày ở staging, mục tiêu 90 ngày ở production tùy hosting và dữ liệu nhạy cảm.

Retention chỉ được purge bằng scheduled maintenance có audit; không cascade xóa bằng thao tác nghiệp vụ thông thường.
