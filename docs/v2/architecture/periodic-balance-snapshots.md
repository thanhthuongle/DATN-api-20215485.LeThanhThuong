# Periodic Balance Snapshot V2

## 1. Mục tiêu

Periodic balance snapshot tạo checkpoint số dư hàng ngày cho từng ledger account nhằm:

- Đối soát chuỗi số dư theo thời gian.
- Phát hiện sai lệch giữa ledger, snapshot và cached balance.
- Tăng tốc rebuild hoặc báo cáo số dư dài hạn.
- Cung cấp audit metadata để điều tra khi dữ liệu không khớp.
- Cho phép worker bắt kịp các ngày bị bỏ lỡ sau downtime.

Snapshot là dữ liệu dẫn xuất. Ledger entries bất biến vẫn là nguồn sự thật.

## 2. Hai loại thời gian

Financial transaction cần phân biệt:

- `occurred_at`: thời điểm nghiệp vụ do người dùng cung cấp, dùng cho lịch sử và báo cáo.
- `posted_at`: thời điểm hệ thống thực sự ghi ledger, do database/hệ thống tạo và bất biến.

Daily balance snapshot dựa trên `posted_at`. Vì vậy giao dịch được nhập hôm nay nhưng có `occurred_at` trong quá khứ vẫn thuộc checkpoint hôm nay. Thiết kế này ngăn snapshot audit quá khứ bị thay đổi âm thầm.

Báo cáo theo ngày nghiệp vụ dựa trên `occurred_at` là read model khác và không được dùng thay ledger checkpoint.

## 3. Đơn vị và lịch snapshot

- Tạo một snapshot cho mỗi ledger account và business date.
- Business date được xác định trực tiếp theo UTC cho toàn hệ thống V1/V2.
- Khoảng ngày là `[00:00:00Z ngày D, 00:00:00Z ngày D+1)`.
- Scheduler chạy mỗi 15 phút để tìm financial spaces đã qua giờ kết thúc ngày nhưng chưa có snapshot.
- Cho phép grace period 15 phút; checkpoint ngày D thường bắt đầu được tạo từ `00:15Z` ngày D+1.
- Ngày không có ledger entry vẫn tạo carry-forward snapshot để snapshot chain liên tục.

Timezone IANA của user chỉ dùng cho reminder/notification, không tham gia accounting snapshot hoặc business date.

## 4. Yêu cầu bổ sung cho ledger entries

Mỗi ledger entry cần tối thiểu:

```text
ledger_account_id
account_sequence
amount
balance_before
balance_after
posted_at
financial_transaction_id
```

Quy tắc:

- `account_sequence` tăng đơn điệu trong từng ledger account.
- Unique `(ledger_account_id, account_sequence)`.
- `posted_at` do hệ thống/database tạo; client không được truyền và application không được sửa.
- Ledger entries đã post không được update/delete; correction dùng reversal.
- `balance_after = balance_before + amount`.

Account sequence được cấp khi account đang bị khóa trong financial transaction. Nó là cutoff ổn định hơn việc chỉ dựa trên timestamp có thể trùng nhau.

## 5. Mô hình dữ liệu đề xuất

Tên bảng dự kiến: `account_balance_snapshots`.

```text
id
ledger_account_id
financial_space_id
business_date
period_start_utc
period_end_utc
opening_balance
total_inflow
total_outflow
closing_balance
first_entry_sequence
last_entry_sequence
cutoff_sequence
cutoff_posted_at
entry_count
calculation_version
checksum
status
is_current
superseded_by_id
superseded_at
generated_at
created_at
updated_at
```

Constraint/index tối thiểu:

```text
UNIQUE(ledger_account_id, business_date, calculation_version)
CHECK(total_inflow >= 0)
CHECK(total_outflow >= 0)
CHECK(closing_balance = opening_balance + total_inflow - total_outflow)
INDEX(financial_space_id, business_date)
INDEX(status, business_date)
```

Mỗi account/date chỉ có một version `is_current = true` bằng partial unique index. Rebuild không ghi đè lịch sử: version cũ chuyển `SUPERSEDED`, bắt buộc `is_current = false` và lưu `superseded_by_id/superseded_at`; successor phải là row khác, cùng account/space/business date, có `calculation_version` lớn hơn và đã `VALID/current`. Sau transition, successor metadata của version cũ bất biến. Version mới chỉ thành current sau khi tính và đối soát thành công.

`first_entry_sequence` và `last_entry_sequence` có thể null với ngày không có giao dịch.

Trạng thái:

- `VALID`: snapshot đã tính và đối soát thành công.
- `FAILED`: generator hoặc reconciliation thất bại.
- `STALE`: cần rebuild do sửa thuật toán hoặc phát hiện corruption; không dùng cho báo cáo/checkpoint.
- `REBUILDING`: đang được tạo lại có kiểm soát.
- `SUPERSEDED`: version lịch sử đã được thay bằng version current mới.

Snapshot run/audit metadata nên lưu riêng:

```text
balance_snapshot_runs
- id
- financial_space_id
- business_date
- trigger_type: SCHEDULED | MANUAL | CATCH_UP | REBUILD
- status
- started_at
- completed_at
- accounts_total
- accounts_succeeded
- accounts_failed
- error_summary
- calculation_version
```

Run có unique `(financial_space_id, business_date, calculation_version, trigger_type)` hoặc một idempotency key tương đương.

## 6. Công thức

Với một account trong business date D:

```text
opening_balance = snapshot(D-1).closing_balance
total_inflow    = SUM(amount) với amount > 0 trong period
total_outflow   = SUM(ABS(amount)) với amount < 0 trong period
closing_balance = opening_balance + total_inflow - total_outflow
```

Snapshot đầu tiên dùng opening ledger transaction hoặc tổng ledger trước `period_start_utc` theo quy tắc bootstrap đã được đối soát.

Checksum snapshot gồm metadata canonical và entry-chain hash. Entry-chain hash duyệt entries theo `account_sequence`, nối tối thiểu `entry_id`, `account_sequence`, `amount`, `balance_before`, `balance_after`, `posted_at` và transaction ID. Nhờ vậy thay đổi một entry vẫn bị phát hiện dù tổng cuối ngày không đổi.

Metadata canonical tối thiểu:

```text
ledger_account_id
business_date
opening_balance
total_inflow
total_outflow
closing_balance
first_entry_sequence
last_entry_sequence
cutoff_sequence
cutoff_posted_at
entry_count
calculation_version
```

Checksum dùng để phát hiện snapshot bị thay đổi ngoài generator; nó không thay thế reconciliation với ledger.

## 7. Thuật toán generator

Cho mỗi financial space/business date:

1. Tạo hoặc lấy snapshot run bằng idempotency key `(financial_space_id, business_date, calculation_version)`.
2. Nếu run đã hoàn thành, trả kết quả cũ.
3. Lấy danh sách ledger accounts thuộc financial space theo thứ tự ID ổn định.
4. Với từng account, mở transaction và khóa ledger account theo cùng quy ước transaction core.
5. Lấy snapshot hợp lệ gần nhất trước ngày D.
6. Sau khi lấy lock, đọc `clock_timestamp()` và current account sequence từ PostgreSQL để có stable read watermark. Không dùng timestamp được đọc trước lock.
7. Lấy ledger entries trong period UTC; `cutoff_sequence` là sequence cuối cùng đã bao phủ tới period end (carry từ ngày trước nếu ngày D không có entry), không phải sequence của entry phát sinh sau `period_end_utc`. Lưu `cutoff_posted_at`/period end tương ứng.
8. Tính opening/inflow/outflow/closing/count/cutoff/checksum.
9. So sánh closing balance với `balance_after` của last entry trong cutoff nếu có.
10. Insert version theo `(ledger_account_id, business_date, calculation_version)` và chuyển current version trong cùng transaction.
11. Ghi kết quả account vào run audit.
12. Chỉ đánh dấu run thành công khi tất cả account cần thiết đã thành công.

Không giữ một database transaction lớn cho toàn bộ financial space. Xử lý từng account/batch để tránh lock lâu; snapshot run theo dõi partial failure và retry.

## 8. Idempotency và concurrency

- Unique constraints là lớp bảo vệ cuối cùng chống snapshot trùng.
- Nhiều worker có thể cùng nhận job nhưng chỉ một run/account được quyền generate tại một thời điểm.
- Có thể dùng PostgreSQL advisory lock hoặc lock row snapshot run theo financial space/date.
- Retry phải trả cùng kết quả khi ledger cutoff không đổi.
- Snapshot generator chỉ đọc ledger và ghi snapshot tables; không cập nhật ledger hoặc account balance.
- Failure của snapshot không rollback financial transaction đã commit trước đó.
- Posting và snapshot cùng lấy account lock theo một thứ tự. Vì sequence được cấp khi giữ lock, snapshot không thể bỏ sót entry đã nằm trước cutoff hoặc nhận entry nửa chừng.

## 9. Backdated transaction và reversal

### Backdated transaction

Ví dụ ngày 05/08 người dùng nhập giao dịch có `occurred_at = 30/07`:

- Ledger entry có `posted_at = 05/08`.
- Checkpoint ngày 30/07 không thay đổi.
- Entry thuộc checkpoint ngày 05/08.
- Báo cáo chi tiêu theo ngày nghiệp vụ vẫn xếp giao dịch vào 30/07 bằng `occurred_at`.

### Reversal

- Không sửa entry gốc.
- Reversal tạo entries mới với `posted_at` mới.
- Reversal thuộc checkpoint ngày được post.
- Chuỗi snapshot cũ giữ nguyên để audit.

Chỉ đánh dấu snapshot cũ `STALE` khi phát hiện corruption, migration sai hoặc nâng `calculation_version`; không dùng `STALE` chỉ vì người dùng tạo giao dịch backdated hợp lệ.

## 10. Reconciliation

Reconciliation có ba cấp:

### Cấp entry

```text
balance_after = balance_before + amount
sequence liên tục, không trùng
```

### Cấp snapshot

```text
closing = opening + inflow - outflow
opening(D) = closing(D-1)
entry_count/cutoff/checksum khớp ledger
```

### Cấp current balance

Nếu snapshot cutoff là entry mới nhất hiện tại:

```text
snapshot.closing_balance = ledger_account.current_balance
```

Nếu có entries sau cutoff, reconciliation cộng phần delta sau cutoff trước khi so sánh current balance.

Sai lệch tạo alert/report và đánh dấu snapshot không hợp lệ; không tự sửa ledger hoặc cached balance.

## 11. Rebuild và catch-up

### Catch-up

Khi worker ngừng nhiều ngày:

1. Tìm business date cuối cùng có snapshot hợp lệ.
2. Generate tuần tự từng ngày còn thiếu.
3. Không bỏ qua ngày không có giao dịch.
4. Dừng chain của account nếu một ngày thất bại.

### Rebuild

Rebuild yêu cầu:

- Phạm vi account/date rõ ràng.
- Lý do và actor/system trigger.
- Tăng `calculation_version` khi thuật toán thay đổi.
- Audit trước/sau và checksum.
- Không update/delete ledger entries.
- Rebuild tuần tự từ ngày bắt đầu đến ngày hiện tại nếu opening balance chain bị ảnh hưởng.

### Account lifecycle

- Snapshot bắt đầu từ ngày account được mở hoặc có opening transaction đầu tiên.
- Account đóng có final snapshot cho ngày đóng và không tiếp tục carry-forward sau final snapshot.
- Reopen nếu được nghiệp vụ cho phép phải tạo lifecycle segment/audit rõ ràng, không nối âm thầm vào closed chain.
- Khi đổi calculation version, rebuild tuần tự toàn range bị ảnh hưởng; chỉ chuyển version mới thành current sau khi chain/reconciliation thành công, version cũ chuyển `SUPERSEDED`.

## 12. Tích hợp Agenda

Trong V2 ban đầu:

- Agenda 5 tiếp tục dùng MongoDB job storage.
- Job snapshot chỉ chứa thông tin kích hoạt như financial space/date.
- Job gọi `balanceSnapshotService.generateDailySnapshots(...)`.
- Logic tính snapshot không nằm trong Agenda definition.
- Job có stable idempotency key và retry an toàn.
- V2 staging dùng worker/job collection tách production.

Khi Agenda được nâng và chuyển backend sau này, snapshot service không phải thay đổi.

## 13. Service và repository dự kiến

```text
src/v2/core/snapshots/
├── balanceSnapshotService.js
├── balanceSnapshotGenerator.js
├── balanceSnapshotReconciliation.js
├── balanceSnapshotRepository.js
├── balanceSnapshotChecksum.js
├── balanceSnapshotPolicies.js
└── index.js
```

Các operation chính:

```text
generateForAccount(accountId, businessDate)
generateForFinancialSpace(financialSpaceId, businessDate)
catchUpFinancialSpace(financialSpaceId, throughDate)
reconcileSnapshot(accountId, businessDate)
rebuildRange(accountId, fromDate, toDate, reason)
getSnapshotStatus(financialSpaceId, businessDate)
```

Rebuild/manual operations chỉ mở qua internal/admin interface có authorization và audit; chưa cần public API cho người dùng V2.

## 14. Monitoring

Theo dõi tối thiểu:

- Snapshot runs thành công/thất bại.
- Số account chưa có snapshot sau grace period.
- Thời gian generate mỗi financial space/account.
- Snapshot chain break.
- Checksum mismatch.
- Ledger/current balance mismatch.
- Số lần retry và catch-up backlog.

Alert mức nghiêm trọng khi có balance mismatch; alert vận hành khi job trễ hoặc snapshot run thất bại nhưng ledger vẫn đúng.

## 15. Test plan

### Unit tests

- Công thức opening/inflow/outflow/closing.
- Checksum deterministic.
- Timezone và day boundary.
- Ngày không có entries.
- Backdated `occurred_at` không đổi checkpoint quá khứ.

### Integration tests

- Generate snapshot từ ledger thực.
- Unique/idempotent upsert.
- Snapshot chain nhiều ngày.
- Reversal trong ngày sau.
- Catch-up nhiều ngày.
- Rebuild range.
- Partial failure và retry.

### Concurrency tests

- Hai workers generate cùng account/date.
- Financial transaction được post trong lúc snapshot đang đọc.
- Snapshot consistent theo cutoff và không làm chậm financial write quá mức.

### Corruption tests

- Sai cached balance.
- Thiếu hoặc trùng account sequence.
- Snapshot checksum sai.
- Opening/closing chain bị đứt.
- Snapshot entry count không khớp ledger.

## 16. Kế hoạch triển khai chi tiết

### Task PBS-01 - Ledger prerequisites

- Thêm `account_sequence` và `posted_at` bất biến.
- Thêm unique/index cần thiết.
- Test concurrent posting và sequence continuity.

### Task PBS-02 - Snapshot schema

- Tạo snapshot status/type.
- Tạo `account_balance_snapshots` và `balance_snapshot_runs`.
- Tạo constraints/indexes.
- Prisma migration và schema validation.

### Task PBS-03 - Calculator và checksum

- Xây pure calculator.
- Xây timezone period resolver.
- Xây checksum canonicalizer.
- Unit tests đầy đủ.

### Task PBS-04 - Generator và repository

- Consistent read và cutoff sequence.
- Per-account idempotent upsert.
- Run audit và partial failure handling.
- Integration/concurrency tests.

### Task PBS-05 - Reconciliation

- Entry, snapshot chain và current balance checks.
- Error report/status transitions.
- Không tự sửa financial data.

### Task PBS-06 - Catch-up và rebuild

- Catch-up ngày thiếu tuần tự.
- Manual rebuild range có authorization/audit.
- Calculation version handling.

### Task PBS-07 - Agenda integration

- Agenda 5 job definition và stable job identity.
- Staging isolation.
- Retry, missed-run catch-up và graceful shutdown tests.

### Task PBS-08 - Observability và runbook

- Metrics, logs và alerts.
- Admin status/report.
- Runbook failure, catch-up và rebuild.

## 17. Definition of Done

- Daily snapshots được tạo cho mọi active ledger account, kể cả ngày không có giao dịch.
- Generator idempotent và an toàn khi nhiều worker chạy đồng thời.
- Snapshot chain và checksum được reconciliation xác nhận.
- Không có snapshot code nào sửa ledger entries hoặc cached balance.
- Backdated transaction và reversal tuân theo quy tắc `posted_at`.
- Catch-up và rebuild được kiểm thử, có audit.
- Agenda retry không tạo snapshot trùng.
- Snapshot failure không chặn financial posting nhưng tạo cảnh báo rõ ràng.
- Contract, integration, concurrency, timezone và corruption tests vượt qua.
