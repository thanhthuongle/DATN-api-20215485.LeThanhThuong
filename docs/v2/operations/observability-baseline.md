# V2 Observability and Control Conventions

Phase 2 establishes conventions and testable primitives only; production dashboards/alerts/runbooks remain progressive deliverables through Phase 11.

## Correlation and logging

- Every V2 HTTP request receives `X-Correlation-Id`; a safe caller-supplied value is preserved, otherwise the API generates a UUID.
- Jobs carry correlation/stable-key context from their handler boundary. Financial operations later add public transaction ID.
- Structured log records require timestamp, level and stable event name. Fields matching authorization/cookie/password/secret/token are redacted recursively in nested objects/arrays; circular references and excessive nesting are replaced with safe sentinels before JSON serialization.
- Logs must not contain full JWTs, cookies, credentials, PII snapshots or unrestricted financial payloads.

Initial event names: `v2.health.checked`, `v2.feature_flag.changed`, `v2.job.started`, `v2.job.completed`, `v2.job.failed`. Owners and concrete runbooks are added with each module/job.

## Initial health/metric ownership

| Signal | Initial owner | Severity/runbook state |
|---|---|---|
| V2 API/PostgreSQL health and latency | platform | staging evidence in `staging-foundation.md`; alert pending deployment |
| Agenda dispatch/lateness/failure | platform + owning module | smoke registry active; per-job runbook required |
| Redis connection/namespace | platform | namespace integration test active |
| Feature-flag change | platform/security | immutable event shape active; persistent source/audit store deferred |

## Feature flag source/cache/audit convention

- Authoritative snapshot has a source version; Redis may cache but is never source of truth.
- Flags default fail-closed and dependencies/write authority are evaluated once at request/job start.
- Changes require actor, reason, before/after, source version and timestamp audit fields.
- Kill switches stop V2 endpoints/jobs and never redirect writes to MongoDB.

## Staging side effects

Allowed modes are email `sink|disabled`, Socket `staging-only|disabled`, notification `capture|disabled`. Any live/production/dispatch mode fails validation. No Phase 2 code wires V2 to V1 production email, Socket or notification providers.
