# Nguyên tắc thiết kế PostgreSQL V2

## 1. Công nghệ

- PostgreSQL là cơ sở dữ liệu quan hệ của V2.
- Supabase PostgreSQL được dùng cho staging trước mắt; production hosting được đánh giá riêng trước cutover.
- Prisma ORM và Prisma Migrate quản lý schema/migrations.
- Prisma dùng cho CRUD và quan hệ thông thường.
- Raw SQL/TypedSQL chỉ dùng cho locking, báo cáo hoặc truy vấn phức tạp; phải parameterized.

## 2. Định danh

- Giữ MongoDB ObjectId dưới dạng `CHAR(24)` trong lần migration đầu.
- Không đồng thời đổi database và đổi toàn bộ ID sang UUID hoặc auto-increment.
- API mapper tiếp tục trả `_id` nếu frontend V1 phụ thuộc trường này.

## 3. Kiểu dữ liệu tài chính

- Amount và balance dùng `BIGINT` phù hợp với tiền nguyên.
- Lãi suất phần trăm dùng `DECIMAL(7,4)`; không tính bằng JavaScript `Number`.
- Saving `annual_rate` và `non_term_annual_rate` dùng đơn vị phần trăm năm, phạm vi `0.0000-100.0000`.
- Tiền lãi chỉ làm tròn ở kết quả cuối theo `HALF_UP` về `BIGINT` đối với VND.
- Loan/borrowing mới phải khai báo rate basis; dữ liệu legacy chưa rõ đơn vị dùng `UNSPECIFIED` và không được tự động tính lãi.
- Không dùng `FLOAT`, `DOUBLE` hoặc phép tính floating point cho tiền.
- Thời gian lưu theo UTC và có độ chính xác phù hợp.

## 4. Quan hệ và ownership

- Embedded arrays chứa ObjectId phải được đánh giá để chuẩn hóa thành foreign key hoặc join table.
- Dùng `financial_spaces` và membership để thống nhất ownership cá nhân/gia đình.
- Không dùng một `ownerId` đa hình không có constraint nếu có thể tránh.
- Mọi foreign key phải có chính sách `RESTRICT`, `CASCADE` hoặc soft-delete được ghi rõ.

## 5. Index và constraint

Schema phải xem xét tối thiểu:

- Unique idempotency key trong đúng scope.
- Index cho financial space, owner/membership, transaction time và category.
- Index cho foreign key thường xuyên join/filter.
- Constraint cho amount hợp lệ và trạng thái.
- Constraint ngăn quan hệ trùng trong join tables.

Tính cân bằng tổng postings được transaction core kiểm tra trước commit và reconciliation kiểm tra lại; không chỉ dựa vào row-level check constraint.

## 6. Migration và seed

- Mọi thay đổi schema phải có Prisma migration hoặc SQL migration được quản lý phiên bản.
- Không sửa production schema thủ công mà không ghi lại migration.
- Seed chỉ chứa dữ liệu hệ thống như banks, default categories hoặc system ledger account types.
- Migration dữ liệu MongoDB -> PostgreSQL dùng scripts riêng, có thể chạy lại và có báo cáo lỗi.

## 7. Periodic balance snapshot

Periodic balance snapshot thuộc phạm vi bắt buộc của V2 và được lưu như daily ledger checkpoint theo `posted_at`:

- Ledger tiếp tục là nguồn sự thật; snapshot là dữ liệu dẫn xuất.
- Mỗi ledger account có tối đa một snapshot cho một business date.
- Snapshot lưu opening balance, inflow, outflow, closing balance, entry count, cutoff sequence và checksum.
- `posted_at` và account entry sequence phải do hệ thống tạo, không nhận từ client và không được sửa.
- Giao dịch backdated dùng `occurred_at` cho báo cáo nhưng thuộc checkpoint tại ngày thực sự được post.
- Snapshot generator phải idempotent và chạy trong consistent database transaction.
- Reconciliation kiểm tra snapshot chain, ledger entries và cached balance.

## 8. Quy trình hoàn thiện schema

Chi tiết bảng không còn là quyết định kiến trúc đang mở mà là deliverable bắt buộc:

- Phase 0 kiểm kê collection, field, kiểu dữ liệu thực tế, quan hệ, query và chất lượng dữ liệu.
- Phase 3A thiết kế logical data model.
- Phase 3B viết physical table specification đến từng column/constraint/index/delete policy.
- Phase 3C tạo Prisma schema và migrations từ specification đã review.
- Phase 3D chạy data profiling/dry run để phát hiện missing values, orphan, duplicate và kiểu dữ liệu sai.

Không field MongoDB nào được bỏ qua nếu chưa có quyết định migrate, transform, archive hoặc drop kèm lý do.

Hosting và phiên bản PostgreSQL production vẫn được theo dõi riêng tại `OPEN-005` trong decision register.
