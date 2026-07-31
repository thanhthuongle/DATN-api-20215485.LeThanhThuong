# Master Plan: MongoDB V1 -> PostgreSQL V2

## 1. Mục tiêu và phạm vi

Xây API V2 trên PostgreSQL mà không làm gián đoạn V1 production. V2 giữ endpoint gần tương ứng V1, tách implementation và bổ sung transaction core, ledger, snapshot, idempotency, outbox và reconciliation.

## 2. Nguyên tắc thực thi

Mỗi phase đi qua quy trình:

```text
phân tích -> cập nhật tài liệu -> triển khai phạm vi nhỏ
-> test -> review -> cập nhật progress -> checkpoint/commit
```

- Không bắt đầu phase phụ thuộc khi phase trước chưa đạt exit criteria.
- Không trộn migration database với refactor không cần thiết hoặc chuyển TypeScript.
- Mỗi task chỉ xử lý một module hoặc một nhóm nhỏ endpoint liên quan.
- V1 phải tiếp tục hoạt động sau mọi phase trước cutover.
- Mọi luồng tiền phải được review về atomicity, locking, idempotency, authorization và rollback.

## 3. Phase 0 - Inventory và đóng băng V1

### Công việc

- Liệt kê routes, methods, middleware và controller/service/model liên quan.
- Ghi request, response và error contract của từng endpoint.
- Liệt kê collections, fields, embedded arrays và quan hệ ObjectId.
- Liệt kê aggregation pipelines và truy vấn báo cáo.
- Liệt kê mọi vị trí tăng/giảm/set balance.
- Liệt kê scheduled jobs, cache và external side effects.
- Xác nhận endpoint frontend đang sử dụng.
- Thiết lập nguyên tắc feature freeze V1.

### Đầu ra

```text
docs/v2/migration/endpoint-inventory.md
docs/v2/database/mongodb-inventory.md
docs/v2/migration/financial-flows.md
docs/v2/migration/background-jobs.md
```

### Exit criteria

- Mỗi endpoint có owner module và dependency rõ ràng.
- Mỗi balance mutation và scheduled financial flow được nhận diện.
- Không còn collection hoặc aggregation chưa phân loại.

## 4. Phase 1 - API versioning

### Công việc

- Tạo `src/api/v1` và đưa/re-export routes hiện tại vào V1.
- Mount V1 tại URL cũ và `/api/v1`.
- Tạo router V2 dưới `/api/v2`.
- Thêm cấu hình bật V2 theo môi trường.
- Thêm health endpoint cho từng version khi phù hợp.

### Exit criteria

- URL cũ không thay đổi hành vi.
- `/api/v1` tương đương URL cũ.
- V2 chỉ được bật trên staging.
- Chưa thay đổi MongoDB controller/service/model trong phase này ngoài import cần thiết.

## 5. Phase 2 - PostgreSQL staging foundation

### Công việc

- Thêm PostgreSQL staging/local Docker service.
- Cấu hình `DATABASE_URL` và database test riêng.
- Cài Prisma, tạo client singleton, migration/seed commands và health check.
- Cô lập Redis namespace, jobs, email, socket và notification staging.
- Chốt framework Redis job.

### Exit criteria

- Có thể dựng database rỗng bằng migrations và seed.
- V1 MongoDB vẫn khởi động bình thường.
- V2 kết nối PostgreSQL staging độc lập.

## 6. Phase 3 - PostgreSQL data model

### Công việc

- Mapping collections/fields sang tables/columns.
- Chuẩn hóa arrays và embedded documents.
- Thiết kế users, families, financial spaces và membership.
- Thiết kế accounts, savings, accumulations, budgets và debts.
- Thiết kế financial transactions, ledger, snapshots, idempotency và outbox.
- Định nghĩa PK, FK, unique constraints, indexes và delete policies.

### Đầu ra

```text
docs/v2/database/mongodb-postgresql-mapping.md
docs/v2/database/postgresql-data-model.md
docs/v2/database/ledger-schema.md
prisma/schema.prisma
```

### Exit criteria

- Schema được review về integrity, ownership và query patterns.
- Amount/balance không dùng floating point.
- Không còn quan hệ đa hình/array ID không có chiến lược rõ ràng.
- Prisma schema validate và migration sạch chạy thành công.

## 7. Phase 4 - Transaction core

### Công việc

- Xây financial transaction orchestration.
- Xây ledger postings và cached balance projection.
- Thêm idempotency, deterministic locking, snapshots, reversal và outbox.
- Xây reconciliation service/job.
- Viết unit, integration, rollback và concurrency tests.

### Exit criteria

- Income, expense và transfer mẫu chạy atomic.
- Retry không double-post.
- Concurrent spending không làm âm hoặc sai balance ngoài rule.
- Failure ở ledger/snapshot/outbox rollback toàn bộ.
- Reversal và reconciliation được kiểm thử.

## 8. Phase 5 - Module nền tảng

### Thứ tự

1. Banks.
2. Users và authentication.
3. Families và membership.
4. Financial spaces.
5. Categories.
6. Contacts.
7. Notifications cơ bản.

### Quy trình mỗi endpoint

```text
copy contract V1 -> V2 route -> V2 controller -> V2 service
-> PostgreSQL repository -> mapper -> contract/integration tests
```

### Exit criteria

- V2 không import MongoDB model.
- Authorization/IDOR được kiểm thử.
- Response tương thích V1 hoặc khác biệt được tài liệu hóa.

## 9. Phase 6 - Nguồn tiền

### Thứ tự

1. Money sources.
2. Accounts.
3. Accumulations.
4. Savings accounts.

### Quy tắc

- Tạo ledger account cùng account nghiệp vụ.
- Opening balance phải là financial transaction.
- Không lưu `transactionIds[]`; truy vấn qua relation/ledger.
- Block, close, deposit và withdrawal tuân theo transaction core.

### Exit criteria

- Không có service/repository ngoài core cập nhật balance.
- Ownership cá nhân/gia đình và trạng thái account được kiểm thử.

## 10. Phase 7 - Transaction endpoints

### Thứ tự

1. Income.
2. Expense.
3. Transfer.
4. Contribution.
5. Loan.
6. Borrowing.
7. Repayment.
8. Collection.
9. Saving deposit, interest, maturity và close.

Mỗi loại phải mô tả account nguồn/đích, system account, quyền actor, balance rule, snapshot, reversal và idempotency scope.

### Exit criteria

- Tất cả financial endpoint gọi transaction core.
- Có tests cho rollback, retry, insufficient balance và concurrency phù hợp.

## 11. Phase 8 - Query, aggregation và báo cáo

### Công việc

- Viết lại transaction lists/details/recent queries.
- Viết lại money source summary, budget spending, debt/saving reports.
- Dùng Prisma cho query thông thường và parameterized TypedSQL/raw SQL cho query phức tạp.
- Kiểm tra execution plan và thêm index theo dữ liệu staging.

### Exit criteria

- Không có unsafe dynamic SQL.
- Query trọng yếu đạt yêu cầu đúng dữ liệu và hiệu năng đã xác định.

## 12. Phase 9 - Budget, cache, notification và jobs

### Công việc

- Chuẩn hóa budget categories và tính spent từ transaction data.
- Tách cache keys V1/V2 và chỉ invalidate sau commit.
- Chuyển scheduled jobs sang Redis-based worker.
- Mọi job tác động tiền gọi transaction core với idempotency key ổn định.
- Xử lý notification/email/socket qua outbox sau commit.

### Exit criteria

- Job retry không tạo tiền/giao dịch trùng.
- Cache không trả dữ liệu chéo version hoặc sai sau transaction.
- Side effects staging được cô lập.

## 13. Phase 10 - Data migration pipeline

### Pipeline

```text
extract -> transform -> load -> reconcile -> report
```

### Yêu cầu

- Script chạy lại không tạo dữ liệu trùng.
- Giữ mapping ObjectId.
- Hỗ trợ batch, checkpoint/resume và dead-letter report.
- Load bảng cha trước bảng con.
- Đối soát counts, totals, balances, debts, savings, foreign keys và ledger.

### Exit criteria

- Migration rehearsal hoàn thành nhiều lần trên staging snapshot.
- Không có orphan hoặc unbalanced transaction.
- Mọi record bị loại đều có báo cáo và quyết định xử lý.

## 14. Phase 11 - Parity, UAT và security review

### Kiểm thử

- Contract parity V1/V2 trên cùng fixtures.
- Integration và financial invariant tests.
- Concurrency, authorization/IDOR và failure-injection tests.
- Performance, cache, jobs và migration rehearsal.
- Diễn tập rollback.

### Exit criteria

- Không có ledger hoặc balance mismatch.
- Endpoint trọng yếu đạt parity hoặc khác biệt đã được chấp nhận.
- Security review, UAT và rollback rehearsal đạt yêu cầu.

## 15. Phase 12 - Production cutover

### Runbook cấp cao

1. Thông báo maintenance và tạo backup MongoDB.
2. Dừng V1 write traffic và MongoDB financial jobs.
3. Chạy final/incremental migration.
4. Chạy reconciliation và xử lý mọi sai lệch.
5. Smoke test V2.
6. Chuyển traffic sang V2.
7. Bật PostgreSQL/Redis jobs.
8. Theo dõi errors, latency, ledger và balances.
9. Giữ MongoDB read-only trong rollback window.

Không xóa MongoDB hoặc tài liệu V1 ngay sau cutover.

## 16. Definition of Done tổng thể

- V2 không import `mongodb`, `ObjectId`, `GET_DB` hoặc MongoDB client.
- PostgreSQL có thể dựng từ migrations và seed.
- Không có service ngoài transaction core cập nhật balance.
- Ledger, idempotency, reversal, snapshots, outbox và reconciliation hoạt động.
- Data migration có thể chạy lại, resume và báo cáo lỗi.
- Không có orphan, unbalanced posting hoặc balance mismatch.
- API contract được kiểm thử với frontend.
- Cutover và rollback runbooks đã được diễn tập.
- Tài liệu V1 hiện có được giữ nguyên; tài liệu V2 nằm dưới `docs/v2/`.

## 17. Mẫu task triển khai có kiểm soát

```text
Task: <một module hoặc 1-3 endpoint liên quan>

Đầu vào:
- Đọc docs/v2/README.md và các tài liệu liên quan.

Scope:
- Liệt kê file/thư mục được phép sửa.

Requirements:
- Giữ contract V1 nếu chưa có quyết định thay đổi.
- Không sửa V1 ngoài scope.
- Financial write phải đi qua transaction core.
- Kiểm tra ownership, idempotency và rollback.

Verification:
- Lint.
- Unit/integration/contract tests tương ứng.
- Review diff về financial integrity và security.

Output:
- File thay đổi.
- Test đã chạy.
- Rủi ro/dependency còn lại.
- Cập nhật docs/v2/migration/progress.md.
```
