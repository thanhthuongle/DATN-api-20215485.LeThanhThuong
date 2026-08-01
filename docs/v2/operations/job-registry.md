# V2 Job Registry

Phase 2 registry contract requires every job to declare owner module, payload version, UTC schedule, stable-key pattern, concurrency/lock policy, retry policy, timeout, side effects, idempotency scope and runbook.

The registry is the only source of Agenda concurrency and lock-lifetime policy. `JobScheduler.define` accepts only the job name and handler; adapter callers cannot override reviewed policy with Agenda options.

| Job | Owner | Payload | UTC/stable key | Concurrency/lock | Retry/timeout | Side effects | Idempotency | Runbook/status |
|---|---|---|---|---|---|---|---|---|
| `v2.infrastructure.smoke` | platform | version 1 | UTC; `v2.infrastructure.smoke:<environment>` | 1; 30s | none; 10s | none | stable key | `staging-foundation.md`; ACTIVE_TEST_ONLY |

No V1 business handler is migrated or registered in Phase 2. Future financial jobs must call transaction core and add approved registry records in their owning phase.

The Agenda store enforces registry stable keys with the code-owned partial unique index `v2_job_stable_key_unique` on `{ name, data.stableKey }`. Workers ensure this index exists before dispatch starts; an incompatible or duplicate-corrupted store therefore fails startup instead of silently accepting duplicate jobs.
