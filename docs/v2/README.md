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
│   └── transaction-core.md
├── database/
│   └── design-rules.md
└── migration/
    ├── decision-register.md
    ├── master-plan.md
    └── progress.md
```

## Thứ tự đọc

1. `migration/decision-register.md`: các quyết định đã thống nhất.
2. `architecture/overview.md`: kiến trúc mục tiêu và trách nhiệm từng tầng.
3. `architecture/transaction-core.md`: quy tắc xử lý tiền, ledger và snapshot.
4. `database/design-rules.md`: nguyên tắc thiết kế PostgreSQL.
5. `migration/master-plan.md`: kế hoạch triển khai theo phase.
6. `migration/progress.md`: trạng thái thực tế của công việc.

`migration/master-plan.md` là kế hoạch tổng thể. `migration/progress.md` mới là nguồn xác định phase nào đã thực sự được triển khai và nghiệm thu.
