# Job Scheduler Abstraction V2

## 1. Mục tiêu

Tách business handler khỏi Agenda và backend lưu job ngay từ Phase 2. Agenda 5/MongoDB vẫn được giữ trong lần cutover đầu, nhưng code V2 không được phụ thuộc trực tiếp vào API, collection hoặc connection của Agenda.

```text
Scheduler adapter -> Job handler -> V2 service/transaction core
```

- Scheduler quyết định khi nào dispatch.
- Handler validate payload, tạo correlation/idempotency context và gọi service.
- Service/core thực hiện nghiệp vụ; không import Agenda.

## 2. Contract tối thiểu

```text
define(jobName, handler, options)
scheduleOnce(jobName, runAt, payload, stableKey)
scheduleRecurring(jobName, schedule, payload, stableKey)
cancel(stableKey)
start()
stopGracefully()
```

Adapter đầu tiên là `Agenda5MongoScheduler`. Phase 13 có thể thay bằng `Agenda6MongoScheduler`, Phase 14 thay backend PostgreSQL mà không sửa handler hoặc service.

Mỗi job phải có registry entry gồm owner module, payload version/schema, schedule theo UTC, stable key, concurrency/lock policy, retry/backoff, timeout, side effects, idempotency scope và runbook.

## 3. Ranh giới an toàn

- Financial job bắt buộc gọi transaction core với stable idempotency key.
- Agenda không chứa logic tính balance, interest, snapshot hoặc notification.
- Side effect sau commit đi qua outbox khi phù hợp.
- Staging dùng database/collection, worker identity và external side-effect configuration riêng.
- Scheduler adapter có contract tests chung để cùng một bộ test chạy được với adapter hiện tại và adapter thay thế.
- Feature flag có thể ngăn dispatch/handler, nhưng không được bỏ qua transaction-core idempotency.

## 4. Deliverables Phase 2

- `JobScheduler` contract và Agenda 5 adapter.
- Job registry template và ít nhất một non-financial smoke job.
- Fake/in-memory adapter chỉ dùng cho unit test; integration test vẫn chạy adapter thật.
- Test graceful shutdown, duplicate stable key và staging isolation.

Việc chuyển toàn bộ job handlers nghiệp vụ có thể diễn ra theo module ở Phase 5-9; abstraction và boundary phải tồn tại trước.
