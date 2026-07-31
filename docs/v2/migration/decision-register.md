# Decision Register V2

Tệp này ghi lại các quyết định đã thống nhất. Thay đổi quyết định phải bổ sung lý do và ảnh hưởng, không sửa lịch sử một cách im lặng.

| ID | Quyết định | Trạng thái |
|---|---|---|
| DEC-001 | V1 tiếp tục chạy production bằng MongoDB trong thời gian phát triển V2. | Accepted |
| DEC-002 | V2 dùng PostgreSQL và chỉ chạy staging cho đến khi hoàn thiện. | Accepted |
| DEC-003 | Không dual-write MongoDB/PostgreSQL; cutover trong maintenance window. | Accepted |
| DEC-004 | Routes V1 và V2 tương ứng về endpoint; controller/service/repository triển khai riêng. | Accepted |
| DEC-005 | V2 tiếp tục dùng tên `service`, không thêm tầng tên `use-case`. | Accepted |
| DEC-006 | V2 dùng Prisma ORM, Prisma Migrate, Joi và Redis. | Accepted |
| DEC-007 | Transaction core là nơi duy nhất cập nhật số dư. | Accepted |
| DEC-008 | Ledger là nguồn sự thật; current balance là cached projection. | Accepted |
| DEC-009 | V2 dùng double-entry/signed postings, idempotency, reversal và reconciliation. | Accepted |
| DEC-010 | Snapshot gồm business JSONB có version và balance before/after. | Accepted |
| DEC-011 | Giữ ObjectId dưới dạng `CHAR(24)` trong lần migration đầu. | Superseded by DEC-022 |
| DEC-012 | Tiền dùng `BIGINT`, tỷ lệ dùng `DECIMAL`, thời gian thống nhất UTC. | Accepted |
| DEC-013 | Tất cả tài liệu mới của V2 nằm dưới `docs/v2/`; không xóa hoặc thay thế docs hiện có. | Accepted |
| DEC-014 | V1 feature freeze; chỉ sửa lỗi cần thiết trong thời gian xây V2. | Accepted |
| DEC-015 | Scheduled jobs tác động tiền phải gọi transaction core. | Accepted |
| DEC-016 | Giữ Agenda 5 và MongoDB job storage trong quá trình phát triển/cutover V2; sau cutover nâng Agenda 5 lên 6 với MongoDB backend trước, rồi mới chuyển Agenda 6 sang PostgreSQL backend ở một bước độc lập. | Accepted |
| DEC-017 | Dùng Supabase PostgreSQL cho môi trường staging trước mắt; hosting PostgreSQL production sẽ được đánh giá riêng trước cutover. | Accepted |
| DEC-018 | Periodic balance snapshot được hoãn thành feature hậu V2; V2 bắt buộc vẫn có business snapshot, balance before/after và reconciliation. | Superseded by DEC-020 |
| DEC-019 | Cutover mặc định trong khung 00:00-02:00 Asia/Ho_Chi_Minh; dành 45 phút go/no-go, 2 giờ early monitoring, 7 ngày hypercare và giữ MongoDB read-only/backup tối thiểu 30 ngày. Ngày cutover cụ thể được chọn sau rehearsal. | Accepted |
| DEC-020 | Periodic balance snapshot là feature bắt buộc của V2, triển khai dưới dạng daily ledger checkpoint theo `posted_at`; Phase 4 xây core/schema và Phase 9 nối lịch chạy Agenda. | Accepted |
| DEC-021 | Lãi suất phần trăm dùng `DECIMAL(7,4)` và decimal arithmetic; saving dùng annual percent, ACTUAL/365 và HALF_UP về BIGINT. Loan/borrowing V2 bắt buộc chọn rate basis; dữ liệu legacy chưa rõ dùng `UNSPECIFIED`. | Accepted |
| DEC-022 | PostgreSQL dùng `BIGINT IDENTITY` làm khóa nội bộ, UUID do database tạo làm public ID, và `legacy_mongo_id CHAR(24)` nullable/unique để mapping dữ liệu V1. API không lộ internal ID. | Accepted |
| DEC-023 | Sau cutover, MongoDB business collections ở read-only; Agenda 5 dùng database/collection MongoDB riêng vẫn read-write cho đến khi hoàn thành các phase loại MongoDB. | Accepted |
| DEC-024 | Ledger chỉ được chuyển `DRAFT -> POSTED` khi database boundary xác nhận tổng postings bằng 0; repository không cung cấp API post từng entry độc lập. | Accepted |
| DEC-025 | Snapshot cutoff dùng account lock, account sequence high-watermark và `clock_timestamp()` tại thời điểm posting; snapshot có version/history và checksum chuỗi entries. | Accepted |
| DEC-026 | Sai lệch migration/reconciliation/snapshot/outbox/jobs được lưu thành discrepancy case và vận hành qua Admin Operations; admin không sửa balance/ledger trực tiếp. | Accepted |
| DEC-027 | Chỉ hỗ trợ rollback về V1 trước khi mở V2 writes. Sau khi V2 nhận writes, chiến lược là forward-fix hoặc restore V2, không reverse-migrate về MongoDB. | Accepted |
| DEC-028 | Sau cutover bổ sung Phase 13 nâng Agenda 5 -> 6 với MongoDB, Phase 14 chuyển Agenda 6 sang PostgreSQL, Phase 15 retire MongoDB. | Accepted |
| DEC-029 | V2 dùng Node.js 20+, Vitest, Supertest, V8 coverage và disposable PostgreSQL/MongoDB/Redis test infrastructure; automated tests không dùng Supabase staging. | Accepted |
| DEC-030 | V2 ban đầu chỉ hỗ trợ VND; tiền lưu `BIGINT` theo đơn vị 1 VND và API serialize amount/balance thành decimal string. | Accepted |
| DEC-031 | Balance policy kế thừa V1: normal account có thể có opening balance âm nhưng outgoing operation không được làm giảm dưới 0; saving/accumulation không âm; system/loan ledger accounts theo normal-side policy riêng. | Accepted |
| DEC-032 | Toàn bộ persisted timestamps và day calculations dùng UTC; lãi không kỳ hạn tương thích V1 theo ngày bắt đầu/kết thúc inclusive, còn kỳ hạn tháng dùng công thức tháng hiện tại. | Accepted |
| DEC-033 | V2 dùng module layout hybrid: giữ tên service; module nhỏ có thể phẳng, module phức tạp tách services/repositories/validators/mappers/policies theo hành động. | Accepted |
| DEC-034 | Financial transaction dùng deterministic row locks, transaction timeout và retry hữu hạn cho serialization/deadlock; idempotency có request fingerprint; outbox delivery at-least-once với consumer idempotency. | Accepted |

## Quyết định đang mở

| ID | Nội dung | Thời điểm chốt |
|---|---|---|
| OPEN-005 | Chọn PostgreSQL hosting và cấu hình production sau giai đoạn Supabase staging. | Trước Phase 12 |
