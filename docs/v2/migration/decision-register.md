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
| DEC-011 | Giữ ObjectId dưới dạng `CHAR(24)` trong lần migration đầu. | Accepted |
| DEC-012 | Tiền dùng `BIGINT`, tỷ lệ dùng `DECIMAL`, thời gian thống nhất UTC. | Accepted |
| DEC-013 | Tất cả tài liệu mới của V2 nằm dưới `docs/v2/`; không xóa hoặc thay thế docs hiện có. | Accepted |
| DEC-014 | V1 feature freeze; chỉ sửa lỗi cần thiết trong thời gian xây V2. | Accepted |
| DEC-015 | Scheduled jobs tác động tiền phải gọi transaction core. | Accepted |

## Quyết định đang mở

| ID | Nội dung | Thời điểm chốt |
|---|---|---|
| OPEN-001 | Chọn BullMQ hay Redis backend khác cho scheduled jobs. | Phase 2/9 |
| OPEN-002 | Chọn PostgreSQL hosting và cấu hình production. | Trước Phase 10 |
| OPEN-003 | Chu kỳ periodic balance snapshot. | Sau V2 core hoặc khi có yêu cầu hiệu năng |
| OPEN-004 | Thời lượng maintenance và rollback window. | Trước cutover |
