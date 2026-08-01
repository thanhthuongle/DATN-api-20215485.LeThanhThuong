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
│   ├── api-security-contracts.md
│   ├── implementation-guardrails.md
│   ├── job-scheduler.md
│   ├── periodic-balance-snapshots.md
│   ├── transaction-runtime.md
│   └── transaction-core.md
├── database/
│   ├── design-rules.md
│   ├── interest-rate-rules.md
│   ├── mongodb-inventory.md
│   └── data-quality-report.md
├── migration/
│   ├── background-jobs.md
│   ├── decision-register.md
│   ├── data-migration-strategy.md
│   ├── endpoint-inventory.md
│   ├── file-lifecycle-inventory.md
│   ├── financial-flows.md
│   ├── financial-invariant-matrix.md
│   ├── final-migration-strategy.md
│   ├── execution-waves.md
│   ├── identity-auth-inventory.md
│   ├── master-plan.md
│   ├── migration-rule-catalog.md
│   ├── progress.md
│   ├── shadow-validation.md
│   ├── timezone-inventory.md
│   └── wave-0-review.md
├── operations/
│   ├── agenda-retirement.md
│   └── production-readiness.md
└── testing/
    └── strategy.md
```

## Thứ tự đọc

1. `migration/decision-register.md`: các quyết định đã thống nhất.
2. `architecture/overview.md`: kiến trúc mục tiêu và trách nhiệm từng tầng.
3. `architecture/api-security-contracts.md`: HTTP boundary, UUID/token cutover, session security và OpenAPI.
4. `architecture/transaction-core.md`: quy tắc xử lý tiền, ledger và snapshot.
5. `architecture/transaction-runtime.md`: transaction context, reversal, idempotency, outbox và asset lifecycle.
6. `architecture/implementation-guardrails.md`: ID, ledger enforcement, transactions, money và module boundaries.
7. `architecture/job-scheduler.md`: abstraction scheduler, Agenda isolation và timezone reminder.
8. `architecture/admin-operations.md`: discrepancy cases và vận hành thủ công an toàn.
9. `architecture/periodic-balance-snapshots.md`: thiết kế và kế hoạch chi tiết daily ledger checkpoint.
10. `migration/financial-invariant-matrix.md`: invariant/posting template và gate trước transaction core.
11. `database/design-rules.md`: nguyên tắc thiết kế PostgreSQL.
12. `database/interest-rate-rules.md`: kiểu dữ liệu, đơn vị và cách tính/làm tròn lãi suất.
13. `migration/data-migration-strategy.md`: rule catalog, pipeline và reconciliation migration.
14. `migration/final-migration-strategy.md`: full reload, legacy balance resolution và Agenda pre-cutover isolation.
15. `migration/shadow-validation.md`: differential replay an toàn trước cutover.
16. `testing/strategy.md`: hạ tầng và test gates.
17. `operations/production-readiness.md`: hosting gate, RPO/RTO, restore, observability và feature flags.
18. `operations/agenda-retirement.md`: lộ trình nâng Agenda và loại MongoDB.
19. `migration/master-plan.md`: kế hoạch kiến trúc/dependency theo phase.
20. `migration/execution-waves.md`: cách chia phase thành các đợt triển khai, vertical slices và staging gates.
21. `migration/progress.md`: trạng thái thực tế của wave/phase/task.

Các inventory Wave 0 được tra cứu từ `migration/wave-0-review.md`; file này liên kết endpoint, MongoDB/data quality, financial flow, jobs, identity, timezone, file lifecycle và draft migration rules theo evidence V1.

`migration/master-plan.md` định nghĩa nội dung/dependency; `migration/execution-waves.md` định nghĩa thứ tự thực thi có kiểm soát. `migration/progress.md` là nguồn xác định wave/phase/task nào đã thực sự được triển khai và nghiệm thu.
