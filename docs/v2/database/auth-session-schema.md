# Authentication and Session Physical Schema

Ngày review: 2026-08-02. Scope: Wave 2 schema only; no auth endpoint implementation.

## `users`

| Column | PostgreSQL | Null/default | Source/rule |
|---|---|---|---|
| `id` | `BIGINT GENERATED ALWAYS AS IDENTITY` | PK | Internal only. |
| `public_id` | `UUID` | NOT NULL, `gen_random_uuid()` | API/JWT `sub`; unique. |
| `legacy_mongo_id` | `CHAR(24)` | NULL | `users._id`; unique when non-null. |
| `email` | `VARCHAR(320)` | NOT NULL | Trimmed source display value. |
| `email_normalized` | `VARCHAR(320)` | NOT NULL | Lowercase/canonical comparison key; unique. |
| `password_hash` | `VARCHAR(255)` | NOT NULL | Supported V1 bcrypt hash; never logged. |
| `username` | `VARCHAR(64)` | NOT NULL | V1 username. |
| `username_normalized` | `VARCHAR(64)` | NOT NULL | Canonical unique key. |
| `display_name` | `VARCHAR(256)` | NOT NULL | V1 displayName. |
| `status` | `user_status` | NOT NULL, `INACTIVE` | `ACTIVE`, `INACTIVE`, `LOCKED`, `DELETED`. |
| `avatar_attachment_id` | `BIGINT` | NULL | Deferred FK to attachments; set null on attachment removal. |
| `language_code` | `VARCHAR(16)` | NOT NULL, `'vi'` | V1 language normalized. |
| `currency_code` | `CHAR(3)` | NOT NULL, `'VND'` | Check exactly VND. |
| `timezone` | `VARCHAR(64)` | NOT NULL, `'Asia/Ho_Chi_Minh'` | Validated IANA identifier; source users have no zone. |
| `reminder_enabled` | `BOOLEAN` | NOT NULL, `TRUE` | V1 remindToInput. |
| `reminder_local_time` | `TIME` | NULL | Derived reminder wall-clock intent. |
| `week_start` | `week_day` | NOT NULL, `MONDAY` | V1 startDayOfWeek. |
| `month_start_day` | `SMALLINT` | NOT NULL, `1` | Check 1..31. |
| `auth_version` | `INTEGER` | NOT NULL, `2` | V2 token version/force logout boundary; check >=2. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, `clock_timestamp()` | V1 createdAt transformed UTC. |
| `updated_at` | `TIMESTAMPTZ` | NULL | V1 updatedAt transformed UTC. |
| `deleted_at` | `TIMESTAMPTZ` | NULL | V1 `_destroy`/soft delete. |

Constraints/indexes: PK `id`; unique `public_id`, `legacy_mongo_id`, `email_normalized`, `username_normalized`; checks currency/month day/status-vs-deleted; index `(status, id)`. Delete: user is soft-only after dependent data; all membership/business FKs `RESTRICT`.

## `token_families`

| Column | PostgreSQL | Null/default | Rule |
|---|---|---|---|
| `id` | identity `BIGINT` | PK | Internal. |
| `public_id` | `UUID` | NOT NULL/default | Unique admin-safe ID. |
| `user_id` | `BIGINT` | NOT NULL | FK users `ON DELETE CASCADE` only before governed history; user hard delete otherwise restricted operationally. |
| `status` | `token_family_status` | NOT NULL, `ACTIVE` | `ACTIVE`, `REVOKED`, `COMPROMISED`, `EXPIRED`. |
| `created_ip_hash` | `CHAR(64)` | NULL | Salted/peppered audit hash, not raw IP. |
| `user_agent_hash` | `CHAR(64)` | NULL | Privacy-safe device signal. |
| `revoked_reason` | `VARCHAR(256)` | NULL | Required when revoked/compromised. |
| `revoked_at` | `TIMESTAMPTZ` | NULL | Family-wide revocation time. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time. |

Indexes: unique `public_id`; `(user_id, status, created_at DESC)`; `(status, revoked_at)`. Check status/revocation fields agree.

## `sessions`

| Column | PostgreSQL | Null/default | Rule |
|---|---|---|---|
| `id` | identity `BIGINT` | PK | Internal. |
| `public_id` | `UUID` | NOT NULL/default | Unique session ID/JTI reference. |
| `token_family_id` | `BIGINT` | NOT NULL | FK family `ON DELETE CASCADE`. |
| `user_id` | `BIGINT` | NOT NULL | FK users `ON DELETE CASCADE`; must equal family user via trigger/composite rule. |
| `refresh_token_hash` | `CHAR(64)` | NOT NULL | Unique HMAC/SHA-256 digest; raw token never stored. |
| `status` | `session_status` | NOT NULL, `ACTIVE` | `ACTIVE`, `ROTATED`, `REVOKED`, `EXPIRED`. |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | Refresh expiry. |
| `last_used_at` | `TIMESTAMPTZ` | NULL | Rotation/use time. |
| `replaced_by_session_id` | `BIGINT` | NULL | Self FK `ON DELETE RESTRICT`; unique predecessor. |
| `revoked_at` | `TIMESTAMPTZ` | NULL | Revocation time. |
| `revoked_reason` | `VARCHAR(256)` | NULL | Required when revoked. |
| `csrf_secret_hash` | `CHAR(64)` | NULL | Required only for cookie mode needing CSRF. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time. |

Constraints/indexes: unique `public_id`, `refresh_token_hash`, `replaced_by_session_id` when non-null; indexes `(user_id,status,expires_at)`, `(token_family_id,status,created_at DESC)`, `(status,expires_at)`; check rotated session has replacement and terminal timestamps are coherent.

## Security/role policy

- Application selects session by token hash and may rotate/revoke; `readonly_role` never reads `password_hash`, refresh/CSRF hashes or device hashes (expose a safe view if needed).
- V1 refresh/access/verify token values are not loaded. V2 sessions start empty, forcing login with `sub=users.public_id`, `ver=2`.
- Password/session/security changes create append-only `audit_events`; raw credential material is forbidden in audit/evidence/outbox.
- Runtime role has no `CREATE` on schema/database and no role-management privilege.
