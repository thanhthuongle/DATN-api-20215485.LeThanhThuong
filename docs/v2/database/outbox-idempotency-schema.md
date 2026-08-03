# Idempotency and Outbox Physical Schema

Ngày review: 2026-08-02. Scope: durable command identity and after-commit delivery only.

## `idempotency_records`

| Column | PostgreSQL | Null/default | Rule |
|---|---|---|---|
| `id` | identity `BIGINT` | PK | Internal. |
| `public_id` | `UUID` | NOT NULL/default | Unique. |
| `financial_space_id` | `BIGINT` | NOT NULL | FK space `RESTRICT`. |
| `actor_type` | `idempotency_actor_type` | NOT NULL | `USER`, `JOB`, `ADMIN`, `MIGRATION`. |
| `actor_id` | `VARCHAR(128)` | NOT NULL | User public UUID or stable system identity; never internal ID/token. |
| `operation` | `VARCHAR(96)` | NOT NULL | Registered semantic operation. |
| `idempotency_key` | `VARCHAR(200)` | NOT NULL | Client/job stable key. |
| `request_hash` | `CHAR(64)` | NOT NULL | Canonical semantic request SHA-256. |
| `status` | `idempotency_status` | NOT NULL | `IN_PROGRESS`, `COMPLETED`, `FAILED_FINAL`. |
| `resource_type` | `VARCHAR(64)` | NULL | Result tombstone type. |
| `resource_public_id` | `UUID` | NULL | Durable result identity. |
| `response_status` | `SMALLINT` | NULL | Purgeable replay metadata. |
| `response_body` | `JSONB` | NULL | Redacted/purgeable, no credentials. |
| `error_code` | `VARCHAR(96)` | NULL | Stable terminal code. |
| `lease_owner` | `VARCHAR(128)` | NULL | Claim recovery owner. |
| `lease_expires_at` | `TIMESTAMPTZ` | NULL | Claim recovery timeout. |
| `completed_at` | `TIMESTAMPTZ` | NULL | Terminal time derived from PostgreSQL clock at the `IN_PROGRESS` -> terminal boundary. |
| `response_purge_after` | `TIMESTAMPTZ` | NULL | When a response body is retained this is at least `completed_at + 90 days`; body can purge only after this database-time boundary while key/hash/tombstone remain. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time. |

Unique `(financial_space_id,actor_type,actor_id,operation,idempotency_key)`; indexes `(status,lease_expires_at,id)`, `(resource_type,resource_public_id)`. Checks terminal/resource/response coherence. The database derives terminal time, rejects caller-selected shortened retention, and permits only the one-way `response_body -> NULL` purge after the boundary. Same key/different hash is a conflict; completed financial rows never delete. FK delete `RESTRICT`.

## `outbox_events`

| Column | PostgreSQL | Null/default | Rule |
|---|---|---|---|
| `id` | identity `BIGINT` | PK | Claim ordering. |
| `public_id` | `UUID` | NOT NULL/default | Event/provider idempotency identity, unique. |
| `financial_space_id` | `BIGINT` | NULL | FK space `RESTRICT`; null for global system event. |
| `aggregate_type` | `VARCHAR(64)` | NOT NULL | Registered aggregate name. |
| `aggregate_public_id` | `UUID` | NOT NULL | Public aggregate identity. |
| `aggregate_sequence` | `BIGINT` | NOT NULL | Check >0. |
| `event_type` | `VARCHAR(96)` | NOT NULL | Registered event contract. |
| `event_schema_version` | `INTEGER` | NOT NULL | Check >=1. |
| `payload` | `JSONB` | NOT NULL | Versioned, no secrets/unnecessary PII. |
| `status` | `outbox_status` | NOT NULL, `PENDING` | Pending/processing/delivered/dead-letter/requires-review. |
| `attempt_count` | `INTEGER` | NOT NULL, `0` | Check >=0. |
| `next_attempt_at` | `TIMESTAMPTZ` | NOT NULL/default | Worker eligibility. |
| `lease_owner` | `VARCHAR(128)` | NULL | Worker claim. |
| `lease_expires_at` | `TIMESTAMPTZ` | NULL | Claim timeout. |
| `last_error_code` | `VARCHAR(96)` | NULL | Classified error. |
| `last_error_summary` | `TEXT` | NULL | Redacted/bounded. |
| `delivered_at` | `TIMESTAMPTZ` | NULL | Confirmed terminal delivery. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL/default | Same DB transaction as aggregate write. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL/default | Worker transition time. |

Unique `(aggregate_type,aggregate_public_id,aggregate_sequence)`; indexes `(status,next_attempt_at,id)`, `(aggregate_type,aggregate_public_id,aggregate_sequence)`, `(lease_expires_at) WHERE status='PROCESSING'`. Worker claims by `FOR UPDATE SKIP LOCKED`. Delete `RESTRICT`; payload retention uses redaction/archival, not silent deletion of identity.

## `outbox_delivery_attempts`

| Column | PostgreSQL | Null/default | Rule |
|---|---|---|---|
| `id` | identity `BIGINT` | PK | Append-only. |
| `public_id` | `UUID` | NOT NULL/default | Unique. |
| `outbox_event_id` | `BIGINT` | NOT NULL | FK event `RESTRICT`. |
| `attempt_number` | `INTEGER` | NOT NULL | Check >0. |
| `provider` | `VARCHAR(64)` | NOT NULL | Email/socket/asset/job/notification adapter. |
| `provider_idempotency_key` | `VARCHAR(200)` | NOT NULL | Usually event public ID. |
| `status` | `delivery_attempt_status` | NOT NULL | Started/succeeded/failed/unknown. |
| `started_at` | `TIMESTAMPTZ` | NOT NULL | Database time. |
| `finished_at` | `TIMESTAMPTZ` | NULL | Terminal time. |
| `error_code` | `VARCHAR(96)` | NULL | Classified. |
| `error_summary` | `TEXT` | NULL | Redacted. |
| `provider_receipt` | `JSONB` | NULL | Safe receipt only. |

Unique `(outbox_event_id,attempt_number)` and `(provider,provider_idempotency_key,attempt_number)`; index `(status,started_at)`. Append-only, `RESTRICT`.

## `inbox_receipts`

Columns: `id BIGINT IDENTITY PK`; `public_id UUID DEFAULT gen_random_uuid() UNIQUE`; `consumer VARCHAR(96) NOT NULL`; `event_public_id UUID NOT NULL`; `event_schema_version INTEGER NOT NULL CHECK>=1`; `payload_hash CHAR(64) NOT NULL`; `processed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()`; `result JSONB NULL`. Unique `(consumer,event_public_id)`; no update/delete during replay horizon.

## Atomicity and role rules

- Idempotency claim/recovery, business write, resource tombstone and outbox insert use the same explicit `TransactionContext` where the command is financial.
- Provider/Redis/Socket/Agenda calls are forbidden inside that transaction.
- Unknown provider success moves outbox/attempt to `REQUIRES_REVIEW`/`UNKNOWN`, not blind retry.
- Job role can claim/update outbox and insert attempts/receipts; cannot mutate financial history. Readonly role receives safe views without payloads that contain sensitive business detail.
