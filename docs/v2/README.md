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
│   ├── job-scheduler.md
│   ├── periodic-balance-snapshots.md
│   └── transaction-core.md
├── database/
│   ├── design-rules.md
│   └── interest-rate-rules.md
├── migration/
│   ├── decision-register.md
│   ├── data-migration-strategy.md
│   ├── financial-invariant-matrix.md
│   ├── master-plan.md
│   ├── progress.md
│   └── shadow-validation.md
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
5. `architecture/job-scheduler.md`: abstraction scheduler và ranh giới giữa Agenda, handler và business service.
6. `architecture/admin-operations.md`: discrepancy cases và vận hành thủ công an toàn.
7. `architecture/periodic-balance-snapshots.md`: thiết kế và kế hoạch chi tiết daily ledger checkpoint.
8. `migration/financial-invariant-matrix.md`: invariant/posting template và gate trước transaction core.
9. `database/design-rules.md`: nguyên tắc thiết kế PostgreSQL.
10. `database/interest-rate-rules.md`: kiểu dữ liệu, đơn vị và cách tính/làm tròn lãi suất.
11. `migration/data-migration-strategy.md`: rule catalog, pipeline và reconciliation migration.
12. `migration/shadow-validation.md`: differential replay an toàn trước cutover.
13. `testing/strategy.md`: hạ tầng và test gates.
14. `operations/agenda-retirement.md`: lộ trình nâng Agenda và loại MongoDB.
15. `migration/master-plan.md`: kế hoạch triển khai theo phase.
16. `migration/progress.md`: trạng thái thực tế của công việc.

`migration/master-plan.md` là kế hoạch tổng thể. `migration/progress.md` mới là nguồn xác định phase nào đã thực sự được triển khai và nghiệm thu.
