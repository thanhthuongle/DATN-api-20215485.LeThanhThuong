# Discrepancy, Audit and Migration Control Physical Schema

Ngày review: 2026-08-02. These tables support Phase 3 dry-run evidence and later Admin Operations; no admin API is implemented in Wave 2.

## `migration_runs`

| Column | PostgreSQL | Null/default | Rule |
|---|---|---|---|
| `id` | identity `BIGINT` | PK | Internal run identity. |
| `public_id` | `UUID` | NOT NULL/default | Unique. |
| `run_type` | `migration_run_type` | NOT NULL | `SAMPLE`, `DRY_RUN`, `REHEARSAL`, `FINAL`. |
| `source_snapshot_id` | `VARCHAR(200)` | NOT NULL | Immutable snapshot/fixture identity. |
| `source_checksum` | `CHAR(64)` | NOT NULL | Canonical manifest SHA-256. |
| `mapping_version` | `VARCHAR(64)` | NOT NULL | Field rules version. |
| `schema_version` | `VARCHAR(64)` | NOT NULL | Applied migration version. |
| `status` | `migration_run_status` | NOT NULL | Pending/running/completed/failed/blocked. |
| `started_at` | `TIMESTAMPTZ` | NULL | Run time. |
| `completed_at` | `TIMESTAMPTZ` | NULL | Terminal time. |
| `source_count` | `BIGINT` | NOT NULL, `0` | Check >=0. |
| `loaded_count` | `BIGINT` | NOT NULL, `0` | Check >=0. |
| `rejected_count` | `BIGINT` | NOT NULL, `0` | Check >=0. |
| `summary` | `JSONB` | NULL | Sanitized counts/totals/timings. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time. |

Unique `(source_snapshot_id,source_checksum,mapping_version,schema_version,run_type)`; indexes `(status,created_at DESC)`. Final/rehearsal evidence never deletes; test/sample cleanup is explicit and scoped.

## `migration_source_records`

| Column | PostgreSQL | Null/default | Rule |
|---|---|---|---|
| `id` | identity `BIGINT` | PK | Staging identity. |
| `migration_run_id` | `BIGINT` | NOT NULL | FK run `ON DELETE RESTRICT`. |
| `source_collection` | `VARCHAR(96)` | NOT NULL | One of 26 declared sources or explicit manifest exception. |
| `source_legacy_id` | `CHAR(24)` | NOT NULL | Source `_id`. |
| `source_hash` | `CHAR(64)` | NOT NULL | Canonical raw record hash. |
| `raw_document` | `JSONB` | NOT NULL | Sanitized immutable raw document; password/token values redacted/encrypted-out-of-band according to export policy. |
| `sanitized_document_hash` | `CHAR(64)` | NOT NULL/database-derived | SHA-256 of the exact stored JSONB representation; detects any evidence drift independently from the original source hash. |
| `sanitization_policy_version` | `VARCHAR(32)` | NOT NULL | Redaction policy used before staging. |
| `redaction_manifest` | `JSONB` array | NOT NULL, `[]` | Redacted JSON paths only; never stores the removed secret values. |
| `disposition` | `migration_record_disposition` | NOT NULL, `STAGED` | Staged/loaded/archived/rejected. |
| `target_type` | `VARCHAR(64)` | NULL | Loaded aggregate type. |
| `target_public_id` | `UUID` | NULL | Loaded identity/tombstone. |
| `reject_code` | `VARCHAR(96)` | NULL | Classified reject. |
| `processed_at` | `TIMESTAMPTZ` | NULL | Transform time. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time. |

Unique `(migration_run_id,source_collection,source_legacy_id)`; indexes `(migration_run_id,source_collection,disposition,id)`, `(target_type,target_public_id)`. Source identity/hash, sanitized document/hash/policy/manifest and creation time are immutable; delete is denied. Only `STAGED -> LOADED|ARCHIVED|REJECTED` is allowed and terminal records cannot be reclassified. State-specific checks require target identity for `LOADED`, `ARCHIVE_ONLY` for `ARCHIVED`, reject code for `REJECTED`, and processed time for every terminal state. Application/job/readonly roles have no raw-table access. Correction creates a new migration run and retains the prior evidence.

## `migration_checkpoints`

Columns: `id BIGINT IDENTITY PK`; `public_id UUID DEFAULT gen_random_uuid() UNIQUE`; `migration_run_id BIGINT NOT NULL` FK `RESTRICT`; `graph_level SMALLINT NOT NULL CHECK BETWEEN 0 AND 20`; `source_collection VARCHAR(96) NOT NULL`; `last_source_legacy_id CHAR(24) NULL`; `status checkpoint_status NOT NULL`; `processed_count BIGINT NOT NULL DEFAULT 0 CHECK>=0`; `loaded_count BIGINT NOT NULL DEFAULT 0 CHECK>=0`; `rejected_count BIGINT NOT NULL DEFAULT 0 CHECK>=0`; `canonical_hash CHAR(64) NULL`; `started_at/completed_at TIMESTAMPTZ NULL`; `created_at/updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()`. Unique `(migration_run_id,graph_level,source_collection)`; index `(migration_run_id,status,graph_level)`.

## `discrepancy_cases`

| Column | PostgreSQL | Null/default | Rule |
|---|---|---|---|
| `id` | identity `BIGINT` | PK | Internal. |
| `public_id` | `UUID` | NOT NULL/default | Unique admin-safe ID. |
| `fingerprint` | `CHAR(64)` | NOT NULL | Stable canonical dedup key. |
| `source` | `discrepancy_source` | NOT NULL | Migration/reconciliation/snapshot/outbox/job. |
| `type` | `VARCHAR(96)` | NOT NULL | Classified rule/reject type. |
| `severity` | `discrepancy_severity` | NOT NULL | `BLOCKING`, `REQUIRES_REVIEW`, `AUTO_FIX_SAFE`, `INFO`. |
| `status` | `discrepancy_status` | NOT NULL, `OPEN` | Open/investigating/resolved/ignored. |
| `version` | `INTEGER` | NOT NULL, `1` | Optimistic lock, check >=1. |
| `recurrence_count` | `INTEGER` | NOT NULL, `1` | Check >=1. |
| `financial_space_id` | `BIGINT` | NULL | FK space `RESTRICT`. |
| `migration_run_id` | `BIGINT` | NULL | FK run `RESTRICT`. |
| `resource_type` | `VARCHAR(64)` | NULL | Governed resource type. |
| `resource_public_id` | `UUID` | NULL | Target resource. |
| `legacy_mongo_id` | `CHAR(24)` | NULL | Source identity. |
| `expected_data` | `JSONB` | NULL | Sanitized expected facts. |
| `actual_data` | `JSONB` | NULL | Sanitized actual facts. |
| `evidence` | `JSONB` | NOT NULL | Rule/source hashes/counts, no secrets. |
| `detected_at` | `TIMESTAMPTZ` | NOT NULL/default | Detection time. |
| `assigned_to_user_id` | `BIGINT` | NULL | FK users `RESTRICT`. |
| `resolution_action` | `VARCHAR(96)` | NULL | Approved action. |
| `resolution_note` | `TEXT` | NULL | Required terminal reason. |
| `resolved_by_user_id` | `BIGINT` | NULL | FK users `RESTRICT`. |
| `resolved_at` | `TIMESTAMPTZ` | NULL | Terminal time. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time. |

Unique active fingerprint partial index for open/investigating cases; indexes `(status,severity,detected_at,id)`, `(source,type,status)`, resource and migration run. `BLOCKING` cannot become `IGNORED`; terminal transitions require actor/reason and emit audit event. No direct data fix is performed by this table.

## `audit_events`

| Column | PostgreSQL | Null/default | Rule |
|---|---|---|---|
| `id` | identity `BIGINT` | PK | Append-only sequence. |
| `public_id` | `UUID` | NOT NULL/default | Unique. |
| `actor_type` | `audit_actor_type` | NOT NULL | User/admin/job/migration/system. |
| `actor_public_id` | `UUID` | NULL | User/resource public identity. |
| `action` | `VARCHAR(96)` | NOT NULL | Stable registered action. |
| `resource_type` | `VARCHAR(64)` | NOT NULL | Governed type. |
| `resource_public_id` | `UUID` | NULL | Governed public identity. |
| `financial_space_id` | `BIGINT` | NULL | FK space `RESTRICT`. |
| `correlation_id` | `UUID` | NOT NULL | Trace. |
| `reason` | `TEXT` | NULL | Required for privileged actions. |
| `before_data` | `JSONB` | NULL | Redacted safe snapshot. |
| `after_data` | `JSONB` | NULL | Redacted safe snapshot. |
| `evidence` | `JSONB` | NULL | Checksums/case links, no secrets. |
| `occurred_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL/default | Insert time. |

Indexes `(resource_type,resource_public_id,occurred_at DESC,id DESC)`, `(financial_space_id,occurred_at DESC)`, `(actor_public_id,occurred_at DESC)`. Database trigger rejects update/delete for all roles except controlled break-glass owner procedure, which itself must create external immutable evidence.

## `feature_flag_overrides`

Columns: `id BIGINT IDENTITY PK`; `public_id UUID DEFAULT gen_random_uuid() UNIQUE`; `deployment_environment VARCHAR(32) NOT NULL`; `flag_key VARCHAR(96) NOT NULL`; `enabled BOOLEAN NOT NULL`; `version INTEGER NOT NULL DEFAULT 1 CHECK>=1`; `reason TEXT NOT NULL`; `changed_by_user_id BIGINT NULL` FK users `RESTRICT`; `effective_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()`; `expires_at TIMESTAMPTZ NULL`; `created_at/updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()`. Unique active `(deployment_environment,flag_key)`; index `(deployment_environment,effective_at,expires_at)`. Deployment write authority and production V2 mount are not database-overridable; registry dependencies remain code-owned/fail-closed.

## Grants and retention

- `migration_role`: full DML on migration tables and discrepancy creation, DDL via migrations.
- `application_role`: no access to raw source documents; can create/read discrepancies/audits through approved repositories, cannot update/delete audit events.
- `job_role`: insert/update job/outbox/snapshot discrepancies and audit, no migration raw access.
- `readonly_role`: safe views with raw/evidence/PII redacted.
- All FKs above are `ON DELETE RESTRICT`; controlled test database cleanup is database-level reset, not row cascades.
