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
define(jobName, handler)
scheduleOnce(jobName, runAt, payload, stableKey)
scheduleRecurring(jobName, schedule, payload, stableKey)
cancel(stableKey)
start()
stopGracefully()
```

Adapter đầu tiên là `Agenda5MongoScheduler`. Phase 13 có thể thay bằng `Agenda6MongoScheduler`, Phase 14 thay backend PostgreSQL mà không sửa handler hoặc service.

Mỗi job phải có registry entry gồm owner module, payload version/schema, schedule theo UTC, stable key, concurrency/lock policy, retry/backoff, timeout, side effects, idempotency scope và runbook.

`define` không nhận Agenda policy override. Concurrency và lock lifetime chỉ được lấy từ registry đã review; muốn thay đổi policy phải sửa registry entry và verification tương ứng.

Financial job/business date luôn theo UTC. User reminder/notification lưu IANA timezone trong user profile, chuyển local target time thành UTC `runAt`; không dùng raw offset và không để timezone user thay đổi ngày hạch toán. Khi timezone thay đổi, pending reminders được reschedule bằng stable key.

## 3. Ranh giới an toàn

- Financial job bắt buộc gọi transaction core với stable idempotency key.
- Agenda không chứa logic tính balance, interest, snapshot hoặc notification.
- Side effect sau commit đi qua outbox khi phù hợp.
- Staging chỉ nhận `AGENDA_MONGODB_URI` và `AGENDA_DATABASE_NAME`; code cố định collection riêng `v2_jobs`, tự sinh worker identity từ hostname/process và giữ external side-effect configuration riêng.
- Agenda chỉ nhận `AGENDA_MONGODB_URI`, `AGENDA_DATABASE_NAME` và credential riêng; không dùng business MongoDB credential/store.
- Scheduler adapter có contract tests chung để cùng một bộ test chạy được với adapter hiện tại và adapter thay thế.
- Feature flag có thể ngăn dispatch/handler, nhưng không được bỏ qua transaction-core idempotency.

## 4. Deliverables Phase 2

- `JobScheduler` contract và Agenda 5 adapter.
- Job registry template và ít nhất một non-financial smoke job.
- Fake/in-memory adapter chỉ dùng cho unit test; integration test vẫn chạy adapter thật.
- Test graceful shutdown, concurrent duplicate stable key và staging isolation. MongoDB job store bắt buộc có partial unique index `{ name, data.stableKey }`; adapter bảo đảm index trước khi worker start và coi duplicate-key race là idempotent success khi job đã tồn tại.
- Test IANA timezone conversion/reschedule; không còn hard-coded `.add(7, 'hours')` trong V2.

Việc chuyển toàn bộ job handlers nghiệp vụ có thể diễn ra theo module ở Phase 5-9; abstraction và boundary phải tồn tại trước.
