# Wave 2 Migration Reconciliation Specification

Ngày review: 2026-08-02. Trạng thái: **REVIEWED cho W2-07 / Phase 3D**.

## 1. Boundary

Mỗi run được nhận diện bởi `(source_snapshot_id, source_checksum, mapping_version, schema_version, run_type)`. Raw source được stage bất biến trong `migration_source_records`; mọi record phải kết thúc ở đúng một disposition `LOADED`, `ARCHIVED` hoặc `REJECTED`. Không có đường bỏ qua âm thầm và không có adjustment tự động.

Controlled Wave 2 dry-run dùng fixture sanitize `wave2-sanitized-sample-v1` và PostgreSQL local sạch. Final rehearsal/cutover phải chạy lại cùng specification trên immutable freeze snapshot; evidence Wave 0 production không được coi là freeze snapshot.

## 2. Required gates

| Gate | Check | Pass condition | Failure classification |
|---|---|---|---|
| Manifest | Canonical SHA-256 của collection name, record order và sanitized document | Hash được lưu ở run và mọi financial snapshot | missing/hash drift = `BLOCKING` |
| Collection routing | 26 declared collections có checkpoint | 26/26, kể cả collection rỗng | missing route = unclassified `BLOCKING` |
| Record disposition | source count so với loaded/archive/reject | tổng disposition bằng source count | missing/duplicate disposition = `BLOCKING` |
| Required/null | required fields theo profiler/mapping | không có lỗi chưa phân loại | financial/ownership missing = `BLOCKING`; rule archive rõ ràng được phép |
| Duplicate | `_id`, normalized identity/business keys, header/detail | không conflicting duplicate | conflict không auto-merge |
| Relations | PostgreSQL FK và Mongo relation resolution | 0 orphan đã load | financial/ownership orphan = `BLOCKING` |
| Money/rate | safe integer VND; rate finite và đúng basis | 0 invalid; không floating money | invalid/unsafe/ambiguous interest = `BLOCKING` |
| Posting | mỗi POSTED transaction có >=2 entries, tổng bằng 0, đúng template role/sign/count | 0 unbalanced/template mismatch | `BLOCKING` |
| Entry chain | sequence tăng liên tục; before + amount = after; cached balance bằng entry cuối | exact | `BLOCKING` |
| Stored balance | opening + approved effects so với legacy stored | difference = 0 VND | `BLOCKING`; không tự dùng `MIGRATION_EQUITY` |
| System totals | tổng signed ledger balance theo space | 0 VND | `BLOCKING` |
| Assets/jobs | asset provenance và Agenda payload disposition | không provider mutation; Agenda internals archive/reschedule rule | unowned side effect = review/blocking theo impact |
| Determinism | chạy lại clean DB cùng input/version | source checksum và target hash giống nhau | hash drift = `BLOCKING` |

## 3. Canonical ordering and hashes

- Collections theo dependency graph `L0..L20`; record theo canonical UTC time, source creation time và legacy `_id`.
- Object keys được sort trước SHA-256; raw credentials/tokens không được đưa vào staged JSON hoặc output.
- Target hash chỉ dùng public/legacy identity và canonical business facts; không dùng random/internal identity sequence.
- Checkpoint lưu processed/loaded/rejected count và canonical collection hash để resume không tạo duplicate.

## 4. Balance reconstruction

```text
reconstructed = approved opening effect
              + approved signed detail/lifecycle effects in deterministic order
difference    = legacy stored balance - reconstructed
```

Tolerance luôn là `0 VND`. `MIGRATION_EQUITY` chỉ được dùng qua `migration_anchor_details` có discrepancy, approver, reason và checksum; dry-run không tạo anchor khi mismatch.

## 5. Go/no-go output

Run summary phải ghi source/loaded/archive/reject counts, 26 checkpoint statuses, unclassified error count, discrepancy severity/status, ledger balance results, balance-holder comparison, source checksum, target hash và elapsed time. Go chỉ khi `unclassifiedErrors=0`, `blockingDiscrepancies=0`, `unbalancedTransactions=0` và `balanceMismatches=0`.

Wave 2 controlled result nằm ở `wave-2-dry-run-report.md`. Final cutover vẫn cần immutable Mongo snapshot, ít nhất ba rehearsal và maintenance-budget evidence theo `final-migration-strategy.md`.
