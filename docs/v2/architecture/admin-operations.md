# Admin Operations V2

## 1. Mục tiêu

Admin Operations là mặt phẳng vận hành cho sai lệch migration, reconciliation, snapshot, outbox và scheduled jobs. Nó gồm backend admin API ngay trong V2 và một trang admin có thể xây theo từng bước; trang UI không phải điều kiện để bắt đầu transaction core, nhưng API, dữ liệu và audit phải có trước migration rehearsal.

Triển khai theo dependency: Phase 3 tạo discrepancy/audit schema, Phase 4 tạo internal writer/dedup, Phase 5 mới mở admin API và UI.

## 2. Discrepancy case

Mỗi phát hiện được lưu thành case, không chỉ ghi log:

```text
id, public_id
source: MIGRATION | RECONCILIATION | SNAPSHOT | OUTBOX | JOB
type, severity: BLOCKING | REQUIRES_REVIEW | AUTO_FIX_SAFE | INFO
status: OPEN | INVESTIGATING | RESOLVED | IGNORED
resource_type, resource_public_id, legacy_mongo_id
expected_data JSONB, actual_data JSONB, evidence JSONB
detected_at, assigned_to, resolution_action, resolution_note
resolved_by, resolved_at, created_at, updated_at
```

Case trùng phải được deduplicate bằng fingerprint ổn định. `BLOCKING` chưa resolve làm fail go/no-go cutover. `IGNORED` bắt buộc có quyền cao, lý do và audit; không áp dụng cho ledger mất cân bằng.

## 3. Thao tác được phép

Admin có thể:

- chạy lại reconciliation hoặc migration check;
- rebuild periodic snapshot theo account/range/version;
- retry outbox event hoặc job;
- gán, ghi chú và resolve discrepancy;
- tạo reversal/adjustment thông qua transaction core khi có chứng cứ và phê duyệt.

Admin không được sửa trực tiếp cached balance, ledger entry, transaction đã post hoặc snapshot lịch sử. Mọi sửa tiền phải sinh transaction mới và audit trail.

## 4. API và trang admin

Backend dự kiến đặt dưới `/api/v2/admin` và module riêng `src/v2/modules/admin-operations/`. Migration admin API đã được triển khai Phase 10 tại `src/api/v2/controllers/migrationAdminController.js` và `src/api/v2/routes/migrationRoute.js`.

### Migration admin endpoints (Phase 10)

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/v2/admin/migration/runs` | Liệt kê migration runs (filter by status, runType) |
| GET | `/api/v2/admin/migration/runs/:id` | Chi tiết migration run + discrepancy summary + reconciliation result |
| GET | `/api/v2/admin/discrepancies` | Liệt kê discrepancy cases (filter by status, severity, source) |
| PATCH | `/api/v2/admin/discrepancies/:publicId/resolve` | Resolve discrepancy case với resolution note, action, actor |

Lưu ý: Các endpoints hiện chưa có authentication/authorization middleware. Theo section 5, cần thêm admin auth, deny-by-default và scope check trước production.

Trang admin tối thiểu cần các màn hình:

1. Dashboard health: open/blocking cases, failed jobs/outbox/snapshot runs.
2. Discrepancy queue: lọc, xem evidence, assign và resolve.
3. Transaction investigation: ledger postings, business snapshot, reversal chain.
4. Snapshot operations: chain/checksum, retry/rebuild.
5. Job/outbox operations: attempts, error và retry có kiểm soát.
6. Audit log: ai đã xem/thao tác, trước/sau và lý do.

UI có thể triển khai sau API theo các lát nhỏ, nhưng dashboard và discrepancy queue phải sẵn sàng trước cutover.

## 5. An toàn vận hành

- Admin endpoint dùng authorization riêng, deny-by-default và kiểm tra ownership/scope ở server.
- Thao tác nhạy cảm yêu cầu nhập lý do; reversal/adjustment nên có bước xác nhận lại và có thể bổ sung maker-checker sau.
- Reversal/adjustment bắt buộc step-up authentication bằng mật khẩu và TOTP/MFA; maker-checker được bổ sung khi có từ hai admin phù hợp.
- Audit log append-only, không cho admin sửa/xóa.
- Không đưa secret hoặc dữ liệu nhạy cảm không cần thiết vào evidence/log.
- Rate limit, correlation ID và structured log cho toàn bộ admin requests.
- Retry/rebuild phải idempotent; giao diện phải hiển thị kết quả trước đó thay vì phát lệnh trùng.
- Case dùng optimistic version; phát hiện cùng fingerprint sau khi resolve phải tăng recurrence/reopen theo rule thay vì tạo vô hạn duplicate.

## 6. Quan hệ với cutover

Migration pipeline ghi reject/mismatch vào discrepancy cases. Go/no-go chỉ được duyệt khi không còn case `BLOCKING`, toàn bộ `REQUIRES_REVIEW` đã có quyết định, và báo cáo reconciliation được ký nhận. Sau khi mở V2 writes, công cụ admin chỉ forward-fix hoặc hỗ trợ restore V2; không reverse-migrate writes về V1.
