# Agenda Upgrade and MongoDB Retirement

## 1. Trạng thái hiện tại

Agenda 5 hiện nhận MongoDB address và collection trực tiếp trong `src/agenda/agenda.js`; nó không dùng MongoDB client của business repositories. Vì Agenda 5 vẫn dùng MongoDB driver nội bộ để lưu job, MongoDB chưa thể bị gỡ khỏi runtime chỉ bằng cách loại Mongo models khỏi V2.

Sau cutover:

```text
MongoDB business collections -> read-only
MongoDB Agenda database/collection -> read-write, credential riêng
```

Hai vùng phải tách database/collection, user và quyền để Agenda không thể ghi business collections.

Việc tách Agenda store không chờ Phase 13: staging hoàn thành ở Phase 2 và production transition/rehearsal hoàn thành Phase 9 trước V2 cutover. Phase 13 chỉ nâng major version sau khi store đã cô lập.

## 2. Phase 13 - Agenda 5 lên Agenda 6, giữ MongoDB

- Inventory job definitions, unique keys, repeat interval, lock lifetime, retry và handlers.
- Đọc migration guide/changelog đúng phiên bản sẽ cài; tạo compatibility spike trên branch riêng.
- Nâng Node/runtime nếu release yêu cầu và chạy regression trên MongoDB backend trước.
- Kiểm tra job schema, locking, graceful shutdown, duplicate prevention, timezone UTC và missed-run catch-up.
- Rehearsal bằng bản sao job store; không nâng package và đổi backend trong cùng release.

Exit: Agenda 6 chạy ổn định với MongoDB, toàn bộ financial handlers idempotent và có rollback package/config đã diễn tập.

## 3. Phase 14 - Chuyển Agenda 6 sang PostgreSQL

- Xác nhận PostgreSQL backend chính thức và compatibility với version đã chọn tại thời điểm triển khai.
- Tạo schema/database role riêng cho jobs; không cấp quyền sửa ledger/business tables.
- Không copy mù các job đang chạy. Dừng scheduler, phân loại pending/running/repeating, rồi reschedule bằng stable business key.
- Dùng maintenance window ngắn, single active scheduler và fence token/worker identity để tránh hai backend cùng dispatch.
- Đối soát số job, next run, failed/retry state; financial jobs vẫn dựa vào transaction-core idempotency.

Exit: chỉ PostgreSQL job backend dispatch; Mongo Agenda store ở read-only observation trong thời gian theo dõi và không có duplicate/missed financial job.

## 4. Phase 15 - Retire MongoDB

- Hoàn tất observation period tối thiểu 30 ngày sau chuyển job backend.
- Xác nhận application, worker, scripts, monitoring và secrets không còn kết nối MongoDB.
- Export/backup business collections và Agenda store, kiểm thử khả năng đọc phục vụ audit.
- Thu hồi Mongo credentials/network access rồi mới hạ dịch vụ theo chính sách hosting.
- Cập nhật runbook, dependency lockfile và loại Mongo driver chỉ khi không còn dependency transitively cần nó.

Exit: không có Mongo traffic, backup/audit được xác minh, cảnh báo không phát sinh và quyết định retire được ghi vào decision register.
