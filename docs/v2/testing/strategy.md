# Testing Strategy V2

## 1. Stack chuẩn

- Node.js 20+.
- Vitest làm test runner và V8 coverage.
- Supertest cho HTTP/Express contract và integration tests.
- Testcontainers cho PostgreSQL thật; MongoDB replica set cho V1 contract fixtures; Redis container cho cache/job integration.
- Supabase staging chỉ dùng UAT/rehearsal, không dùng cho automated test.

Database thật trong container là bắt buộc cho transaction, constraint, lock, raw SQL và migration tests; mock Prisma không thay thế được lớp này.

## 2. Các lớp test

1. Unit: validator, mapper, policy, interest và posting template thuần.
2. Database integration: repository, migrations, constraints, trigger/function, idempotency và outbox.
3. Service integration: transaction core với PostgreSQL thật, Redis khi cần.
4. HTTP contract: cùng fixture so response/status/error giữa V1 và V2, cho phép danh sách khác biệt đã duyệt.
5. Migration: extract/transform/load chạy lại, resume và reconciliation.
6. Operational: Agenda handlers, snapshot catch-up, outbox retry và admin actions.

## 3. Test bắt buộc cho tài chính

- Tổng postings bằng 0 và không thể bypass bằng repository/raw insert thông thường.
- Atomic rollback ở mọi failure point.
- Cùng idempotency key không double-post; khác payload trả conflict.
- Concurrent expense/transfer không lost update hoặc vượt balance policy.
- Deadlock/serialization retry hữu hạn và không tạo side effect trùng.
- Reversal giữ entry gốc bất biến.
- Snapshot cutoff không bỏ sót/đếm đôi entry khi transaction và generator chạy đồng thời.
- BigInt vượt `Number.MAX_SAFE_INTEGER` vẫn round-trip chính xác qua API.
- UTC boundary, leap day, month/year boundary và phép tính ngày inclusive.

## 4. Cô lập và lifecycle

- Mỗi test suite dựng database từ migrations, seed fixture tối thiểu và hủy container sau chạy.
- Suite có concurrency dùng database/schema riêng; không phụ thuộc thứ tự test.
- Mongo fixture cần replica set nếu test transaction/hành vi V1 yêu cầu nó.
- Không dùng production/staging credentials trong test command; CI fail sớm nếu URL trỏ Supabase hoặc host không nằm trong allowlist test.

## 5. CI gates

```text
lint -> unit -> migration validation -> database integration
-> contract -> concurrency/failure injection -> coverage/report
```

Merge bị chặn nếu financial invariant, migration validation hoặc contract test trọng yếu fail. Coverage là tín hiệu bổ sung; không dùng một tỷ lệ tổng duy nhất để thay việc kiểm tra các nhánh lỗi tài chính. Phase 2 sẽ chốt script cụ thể sau khi inventory test hiện tại.
