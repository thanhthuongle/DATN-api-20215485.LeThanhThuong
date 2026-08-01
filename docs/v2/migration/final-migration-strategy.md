# Final Migration and Legacy Balance Resolution

## 1. Chiến lược mặc định

Do dữ liệu dự án nhỏ, final cutover dùng full reload sau write freeze, không dựa vào `updatedAt`/ObjectId làm incremental watermark:

```text
maintenance/write freeze -> drain requests/jobs
-> Mongo backup + immutable source manifest/checksum
-> PostgreSQL production sạch từ migrations/seed
-> full extract/transform/load -> reconcile -> smoke/go-no-go
```

Ít nhất ba rehearsal trên cùng source snapshot phải cho kết quả deterministic và chứng minh hoàn thành trong maintenance budget. Chỉ phát triển incremental/change-journal strategy nếu rehearsal cho thấy full reload không đạt thời gian; thay đổi này cần decision riêng.

## 2. Freeze boundary

- Chặn toàn bộ V1 writes ở gateway/application, không chỉ financial endpoints.
- Dừng Agenda jobs có thể ghi business data/notification state; chờ in-flight requests và running jobs kết thúc hoặc hết lock.
- Ghi freeze timestamp UTC, Mongo cluster/session information, collection counts/checksums và migration code/schema version.
- Sau freeze, chỉ migration reader credential được đọc business collections; không remediation trực tiếp ngoài runbook đã duyệt.

## 3. Legacy balance resolution

`account.balance` V1 tại freeze là operational cutover balance vì đây là giá trị production đang dùng. Transaction history được tái dựng và so sánh:

```text
reconstructed_balance == legacy_account_balance -> migrate normally
reconstructed_balance != legacy_account_balance -> BLOCKING discrepancy
```

Tolerance mặc định là `0 VND`. Admin phải chọn một remediation có evidence:

1. sửa dữ liệu V1 có kiểm soát trước final freeze/re-run;
2. phân loại/bổ sung legacy transaction có chứng cứ;
3. phê duyệt explicit migration anchor transaction.

Migration anchor post phần chênh lệch đối ứng với system account `MIGRATION_EQUITY`. Snapshot lưu legacy/reconstructed balance, difference, discrepancy case, approver, reason, source checksum và migration run. Đây là audited financial transaction, không phải silent adjustment.

## 4. Agenda store isolation trước cutover

Agenda phải rời business MongoDB trước khi business collections chuyển read-only:

- Dùng `AGENDA_MONGODB_URI`, `AGENDA_DATABASE_NAME`, `AGENDA_COLLECTION` và credential riêng.
- Staging isolation hoàn thành Phase 2; production rehearsal/transition hoàn thành Phase 9.
- Dừng old worker, drain locks, inventory pending/repeating jobs và reschedule bằng stable business key vào store mới.
- Không copy mù Agenda internal collection/lock state.
- Chỉ một worker fleet được dispatch; business Mongo credential bị thu hồi write sau khi xác minh store mới.

## 5. Go/no-go data gates

- Source manifest/checksum và migration version được lưu.
- Counts, FKs, totals, ledger, current balance, snapshots và system accounts reconcile.
- `0` unbalanced posting, orphan và `BLOCKING` discrepancy.
- Mọi migration anchor có case/evidence/approval.
- Full reload, reconciliation và smoke test nằm trong maintenance budget.
- Trước mở V2 writes vẫn có thể bật lại V1; sau mở writes chỉ restore/forward-fix V2.
