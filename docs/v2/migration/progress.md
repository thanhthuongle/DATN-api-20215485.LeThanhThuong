# Tiến độ Migration V2

Ngày khởi tạo tài liệu: 2026-07-31

## Trạng thái hợp lệ

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `READY_FOR_REVIEW`
- `COMPLETED`

## Tổng quan

| Phase | Nội dung | Trạng thái |
|---|---|---|
| Documentation baseline | Ghi nhận kiến trúc và kế hoạch đã thống nhất | COMPLETED |
| Phase 0 | Inventory và đóng băng hành vi V1 | NOT_STARTED |
| Phase 1 | API versioning | NOT_STARTED |
| Phase 2 | PostgreSQL staging foundation | NOT_STARTED |
| Phase 3 | PostgreSQL data model | NOT_STARTED |
| Phase 4 | Transaction core | NOT_STARTED |
| Phase 4B | Periodic balance snapshot core | NOT_STARTED |
| Phase 5 | Các module nền tảng | NOT_STARTED |
| Phase 6 | Nguồn tiền | NOT_STARTED |
| Phase 7 | Transaction endpoints | NOT_STARTED |
| Phase 8 | Query, aggregation và báo cáo | NOT_STARTED |
| Phase 9 | Budget, cache, notification và jobs | NOT_STARTED |
| Phase 10 | Data migration pipeline | NOT_STARTED |
| Phase 10B | Differential replay và shadow validation | NOT_STARTED |
| Phase 11 | Parity, UAT và security review | NOT_STARTED |
| Phase 12 | Production cutover | NOT_STARTED |
| Phase 13 | Agenda 5 -> Agenda 6 với MongoDB backend | NOT_STARTED |
| Phase 14 | Agenda 6 MongoDB -> PostgreSQL backend | NOT_STARTED |
| Phase 15 | MongoDB retirement | NOT_STARTED |

## Phase đang hoạt động

Chưa có phase triển khai source code nào đang hoạt động. Bước tiếp theo là Phase 0.

## Phase 0 checklist

- [ ] Inventory routes, methods và middleware.
- [ ] Inventory request/response/error contracts.
- [ ] Inventory MongoDB collections và fields.
- [ ] Profile kiểu dữ liệu thực tế, missing/null, duplicate và orphan relationships.
- [ ] Inventory aggregation pipelines.
- [ ] Inventory financial flows và balance mutations.
- [ ] Tạo draft financial invariant/posting template matrix cho 100% financial flows.
- [ ] Inventory scheduled jobs và external side effects.
- [ ] Tạo draft migration rules cho embedded documents, arrays, ObjectId, orphan, duplicate và invalid legacy data.
- [ ] Xác định endpoint frontend đang sử dụng.
- [ ] Ghi chính sách feature freeze cho V1.

## Blockers

Không có blocker đã biết.

## Quy tắc cập nhật

- Chỉ đánh dấu phase `COMPLETED` khi đạt exit criteria trong `master-plan.md`.
- Ghi blocker và quyết định phát sinh trước khi tiếp tục phase phụ thuộc.
- Mỗi lần hoàn thành task phải cập nhật checklist, test đã chạy và commit liên quan.
- Mỗi phase phải ghi acceptance metrics thực tế, đường dẫn evidence/report và approved exceptions trước khi chuyển `COMPLETED`.
