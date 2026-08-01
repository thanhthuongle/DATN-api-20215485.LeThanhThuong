# Tiến độ Migration V2

Ngày khởi tạo tài liệu: 2026-07-31

## Trạng thái hợp lệ

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `READY_FOR_REVIEW`
- `COMPLETED`

## Tổng quan

### Execution waves

| Wave | Phạm vi | Trạng thái |
|---|---|---|
| Wave 0 | Phase 0 - Discovery/V1 freeze | NOT_STARTED |
| Wave 1 | Phase 1-2 - API và staging foundation | NOT_STARTED |
| Wave 2 | Phase 3 - PostgreSQL design freeze | NOT_STARTED |
| Wave 3 | Phase 4-4B - Financial kernel | NOT_STARTED |
| Wave 4A | Phase 5 - Foundation modules | NOT_STARTED |
| Wave 4B | Phase 6 - Sources/accounts | NOT_STARTED |
| Wave 4C | Phase 7 - Income/expense/transfer | NOT_STARTED |
| Wave 4D | Phase 7 - Debt/advanced commands | NOT_STARTED |
| Wave 4E | Phase 7 - Time-based savings | NOT_STARTED |
| Wave 5 | Phase 8-9 - Read models/operations | NOT_STARTED |
| Wave 6 | Phase 10-10B - Migration/differential validation | NOT_STARTED |
| Wave 7 | Phase 11 - Release candidate | NOT_STARTED |
| Wave 8 | Phase 12 - Cutover/hypercare | NOT_STARTED |
| Wave 9 | Phase 13-15 - Agenda/MongoDB retirement | NOT_STARTED |

### Phases

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

## Wave/phase đang hoạt động

Chưa có wave/phase triển khai source code nào đang hoạt động. Bước tiếp theo là Wave 0 / Phase 0.

## Phase 0 checklist

- [ ] Inventory routes, methods và middleware.
- [ ] Inventory request/response/error contracts.
- [ ] Inventory MongoDB collections và fields.
- [ ] Profile kiểu dữ liệu thực tế, missing/null, duplicate và orphan relationships.
- [ ] Inventory aggregation pipelines.
- [ ] Inventory financial flows và balance mutations.
- [ ] Reconstruct transaction-history balances và so với stored account balances, tolerance 0 VND.
- [ ] Tạo draft financial invariant/posting template matrix cho 100% financial flows.
- [ ] Inventory scheduled jobs và external side effects.
- [ ] Inventory Agenda business/job store coupling và kế hoạch credential/database riêng.
- [ ] Inventory JWT/refresh/Socket ObjectId claims và frontend cached IDs cho force logout/UUID transition.
- [ ] Inventory hard-coded timezone compensation và phân loại financial UTC với user reminders.
- [ ] Inventory Cloudinary/file lifecycle và orphan side effects.
- [ ] Tạo draft migration rules cho embedded documents, arrays, ObjectId, orphan, duplicate và invalid legacy data.
- [ ] Xác định endpoint frontend đang sử dụng.
- [ ] Ghi chính sách feature freeze cho V1.

## Blockers

Không có blocker đã biết.

## Gates đã biết

- Phase 4 chờ approved posting/invariant matrix và explicit transaction-context design.
- Phase 10B chờ đóng `OPEN-005`, production hosting/connection mode, RPO/RTO/PITR và restore procedure.
- Phase 12 chờ Agenda store isolation, deterministic full-reload rehearsal, force-logout plan và `0 BLOCKING` discrepancy.

## Quy tắc cập nhật

- Chỉ đánh dấu phase `COMPLETED` khi đạt exit criteria trong `master-plan.md`.
- Chỉ đánh dấu wave `COMPLETED` khi toàn bộ phase/sub-wave trong scope đạt sign-off theo `execution-waves.md`.
- Mỗi thời điểm chỉ có một wave chính `IN_PROGRESS`; không mở task mới chạm cùng schema/core trước khi task hiện tại review xong.
- Ghi blocker và quyết định phát sinh trước khi tiếp tục phase phụ thuộc.
- Mỗi lần hoàn thành task phải cập nhật checklist, test đã chạy và commit liên quan.
- Mỗi phase phải ghi acceptance metrics thực tế, đường dẫn evidence/report và approved exceptions trước khi chuyển `COMPLETED`.
