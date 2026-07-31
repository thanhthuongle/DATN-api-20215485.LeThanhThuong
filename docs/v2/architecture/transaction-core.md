# Transaction Core, Ledger và Snapshot

## 1. Mục tiêu nghiệp vụ

Transaction core tập trung hóa mọi thay đổi tiền. Các service như expense, income, transfer, loan, repayment, saving và contribution không còn tự cộng/trừ balance.

## 2. Luồng bắt buộc

Một financial transaction phải thực hiện nguyên tử:

```text
kiểm tra idempotency
-> mở PostgreSQL transaction
-> khóa ledger accounts theo thứ tự ổn định
-> kiểm tra quyền và điều kiện số dư
-> tạo financial transaction
-> tạo ledger entries
-> kiểm tra tổng postings bằng 0
-> cập nhật cached balance
-> tạo immutable business snapshot
-> ghi outbox event
-> commit
```

Một bước thất bại phải rollback toàn bộ.

## 3. Ledger

- Ledger là nguồn sự thật.
- `current_balance` là projection phục vụ truy vấn nhanh.
- Tiền được biểu diễn bằng số nguyên; không dùng floating point.
- Signed postings âm biểu thị tiền ra, dương biểu thị tiền vào.
- Tổng postings của một giao dịch phải bằng 0.

Ví dụ chuyển 500.000:

```text
Tài khoản nguồn  -500000
Tài khoản đích   +500000
Tổng                   0
```

Thu nhập và chi tiêu dùng ledger account hệ thống như income clearing, expense clearing hoặc opening balance để giữ giao dịch cân bằng.

## 4. Idempotency và concurrency

- Mỗi lệnh ghi tiền phải có idempotency key với phạm vi rõ ràng.
- Request retry hoặc job retry không được tạo giao dịch lần hai.
- Account rows phải được khóa trước thao tác kiểm tra rồi cập nhật số dư.
- Khi khóa nhiều account, core phải khóa theo thứ tự ổn định để giảm deadlock.
- Test concurrency phải chứng minh không thể double-spend.

## 5. Snapshot

### Business snapshot

Lưu thông tin cần giữ nguyên tại thời điểm giao dịch, ví dụ tên tài khoản, category, người chịu trách nhiệm hoặc tỷ giá. Snapshot dùng PostgreSQL JSONB và có `schemaVersion`.

Không snapshot JWT, credential hoặc PII không cần thiết.

### Balance snapshot trên ledger entry

Mỗi posting dự kiến lưu:

```text
balance_before
amount
balance_after
```

Giá trị được tính khi account đang bị khóa trong cùng database transaction.

### Periodic balance snapshot

Periodic balance snapshot chủ yếu là checkpoint để tăng tốc báo cáo và rebuild, không phải nguồn kiểm tra tính đúng đắn chính. Reconciliation mới chịu trách nhiệm kiểm tra ledger với cached balance.

Periodic balance snapshot là feature bắt buộc của V2. Snapshot được tạo hàng ngày như một ledger checkpoint theo `posted_at`, hỗ trợ idempotent generation, checksum, rebuild và reconciliation. Thiết kế chi tiết nằm tại `periodic-balance-snapshots.md`.

Periodic balance snapshot chạy ngoài atomic posting path và không được rollback một financial transaction đã commit. Thuật ngữ `snapshot` bên trong transaction mặc định chỉ business snapshot và `balance_before/balance_after` của ledger entry.

## 6. Reversal

Financial transaction đã post không bị sửa hoặc xóa trực tiếp. Điều chỉnh tiền phải tạo reversal transaction liên kết với giao dịch gốc; metadata không ảnh hưởng tiền có thể có chính sách cập nhật riêng.

## 7. Outbox

Notification, email, socket và background processing không chạy giữa transaction tài chính. Core ghi outbox event trong cùng PostgreSQL transaction; worker chỉ xử lý event sau commit và phải hỗ trợ retry/idempotency.

## 8. Reconciliation

Hệ thống phải kiểm tra định kỳ:

```text
SUM(ledger entries của account) = account.current_balance
```

Sai lệch phải tạo cảnh báo và báo cáo điều tra; không âm thầm chỉnh balance.

## 9. Quy tắc bắt buộc

- `FIN-001`: Chỉ transaction core được cập nhật cached balance.
- `FIN-002`: Tổng postings của một financial transaction phải bằng 0.
- `FIN-003`: Mọi thao tác ghi tiền phải atomic và idempotent.
- `FIN-004`: Giao dịch đã post chỉ được điều chỉnh tiền bằng reversal.
- `FIN-005`: Scheduled job tác động tiền phải gọi transaction core.
- `FIN-006`: Mọi account được sử dụng phải thuộc financial space mà actor có quyền truy cập.
- `FIN-007`: Không tin `userId`, `ownerId` hoặc amount chưa được xác thực từ client.
