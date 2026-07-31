# Nguyên tắc thiết kế PostgreSQL V2

## 1. Công nghệ

- PostgreSQL là cơ sở dữ liệu quan hệ của V2.
- Prisma ORM và Prisma Migrate quản lý schema/migrations.
- Prisma dùng cho CRUD và quan hệ thông thường.
- Raw SQL/TypedSQL chỉ dùng cho locking, báo cáo hoặc truy vấn phức tạp; phải parameterized.

## 2. Định danh

- Giữ MongoDB ObjectId dưới dạng `CHAR(24)` trong lần migration đầu.
- Không đồng thời đổi database và đổi toàn bộ ID sang UUID hoặc auto-increment.
- API mapper tiếp tục trả `_id` nếu frontend V1 phụ thuộc trường này.

## 3. Kiểu dữ liệu tài chính

- Amount và balance dùng `BIGINT` phù hợp với tiền nguyên.
- Lãi suất hoặc tỷ lệ dùng `DECIMAL` có precision/scale được xác định theo nghiệp vụ.
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

## 7. Quy tắc chưa chốt

Các nội dung sau được quyết định trong phase tương ứng:

- Precision/scale cụ thể cho từng loại lãi suất.
- PostgreSQL hosting và phiên bản vận hành cụ thể.
- Framework Redis job cuối cùng.
- Chu kỳ periodic balance snapshot.
- Chi tiết bảng sau khi hoàn thành collection/field inventory.
