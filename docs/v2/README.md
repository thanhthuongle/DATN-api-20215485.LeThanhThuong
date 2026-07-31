# Tài liệu nâng cấp Backend V2

Thư mục này là không gian tài liệu riêng cho quá trình xây dựng API V2 trên PostgreSQL.

## Nguyên tắc bảo toàn tài liệu

- Không xóa, đổi tên hoặc ghi đè tài liệu thiết kế hiện có trong `docs/`.
- Tài liệu cũ mô tả hệ thống V1 và tiếp tục được giữ làm nguồn tham chiếu nghiệp vụ.
- Mọi thiết kế, quyết định và kế hoạch mới dành cho V2 phải được lưu dưới `docs/v2/`.
- Nếu V2 thay đổi một hành vi của V1, thay đổi đó phải được ghi rõ thay vì sửa ngược tài liệu V1.

## Cấu trúc

```text
docs/v2/
├── README.md
├── architecture/
│   ├── overview.md
│   ├── admin-operations.md
│   ├── implementation-guardrails.md
│   ├── periodic-balance-snapshots.md
│   └── transaction-core.md
├── database/
│   ├── design-rules.md
│   └── interest-rate-rules.md
├── migration/
│   ├── decision-register.md
│   ├── master-plan.md
│   └── progress.md
├── operations/
│   └── agenda-retirement.md
└── testing/
    └── strategy.md
```

## Thứ tự đọc

1. `migration/decision-register.md`: các quyết định đã thống nhất.
2. `architecture/overview.md`: kiến trúc mục tiêu và trách nhiệm từng tầng.
3. `architecture/transaction-core.md`: quy tắc xử lý tiền, ledger và snapshot.
4. `architecture/implementation-guardrails.md`: ID, ledger enforcement, transactions, idempotency, outbox, money và module boundaries.
5. `architecture/admin-operations.md`: discrepancy cases và vận hành thủ công an toàn.
6. `architecture/periodic-balance-snapshots.md`: thiết kế và kế hoạch chi tiết daily ledger checkpoint.
7. `database/design-rules.md`: nguyên tắc thiết kế PostgreSQL.
8. `database/interest-rate-rules.md`: kiểu dữ liệu, đơn vị và cách tính/làm tròn lãi suất.
9. `testing/strategy.md`: hạ tầng và test gates.
10. `operations/agenda-retirement.md`: lộ trình nâng Agenda và loại MongoDB.
11. `migration/master-plan.md`: kế hoạch triển khai theo phase.
12. `migration/progress.md`: trạng thái thực tế của công việc.

`migration/master-plan.md` là kế hoạch tổng thể. `migration/progress.md` mới là nguồn xác định phase nào đã thực sự được triển khai và nghiệm thu.
