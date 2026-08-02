# Temporary Asset and Attachment Physical Schema

Ngày review: 2026-08-02. Cloudinary/provider calls remain outside PostgreSQL transactions.

## `temporary_assets`

| Column | PostgreSQL | Null/default | Rule/source |
|---|---|---|---|
| `id` | identity `BIGINT` | PK | Internal. |
| `public_id` | `UUID` | NOT NULL/default | API asset ID, unique. |
| `legacy_mongo_id` | `CHAR(24)` | NULL | Optional source document identity, not provider identity. |
| `owner_user_id` | `BIGINT` | NOT NULL | FK users `RESTRICT`. |
| `financial_space_id` | `BIGINT` | NULL | FK spaces `RESTRICT`; required for space-owned business attachment. |
| `upload_session_id` | `UUID` | NOT NULL | Stable upload attempt/session. |
| `provider` | `asset_provider` | NOT NULL | `CLOUDINARY`, `LEGACY_EXTERNAL`, test provider. |
| `provider_public_id` | `VARCHAR(512)` | NULL | Provider delete/finalize identity. |
| `provider_resource_type` | `VARCHAR(64)` | NULL | Provider resource kind. |
| `secure_url` | `TEXT` | NOT NULL | Validated URL; never ownership authority alone. |
| `checksum_sha256` | `CHAR(64)` | NULL | Required for newly uploaded V2 asset. |
| `content_type` | `VARCHAR(128)` | NULL | Server-inspected type. |
| `size_bytes` | `BIGINT` | NULL | Check >=0 and policy limit. |
| `status` | `temporary_asset_status` | NOT NULL, `TEMPORARY` | `TEMPORARY`, `LINKED`, `ACTIVE`, `EXPIRED`, `QUARANTINED`, `DELETED`, `REQUIRES_REVIEW`. |
| `expires_at` | `TIMESTAMPTZ` | NULL | New temporary default creation+24h; null for legacy review. |
| `activated_at` | `TIMESTAMPTZ` | NULL | Outbox finalization time. |
| `deleted_at` | `TIMESTAMPTZ` | NULL | Provider-confirmed deletion tombstone. |
| `source_provenance` | `JSONB` | NULL | Collection/path/index/provider manifest hashes; no secret. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time/source time. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL/default | Lifecycle time. |

Constraints/indexes: unique `public_id`; unique `(provider,provider_public_id)` when provider ID non-null; unique `(owner_user_id,upload_session_id,checksum_sha256)` when checksum non-null; worker index `(status,expires_at,id)`; ownership index `(financial_space_id,status,id)`. Status/timestamp/provider metadata checks. `RESTRICT` when attachment/evidence exists; cleanup transitions/tombstones rather than hard delete.

## `attachments`

| Column | PostgreSQL | Null/default | Rule |
|---|---|---|---|
| `id` | identity `BIGINT` | PK | Internal. |
| `public_id` | `UUID` | NOT NULL/default | API attachment ID, unique. |
| `asset_id` | `BIGINT` | NOT NULL | FK temporary asset `RESTRICT`. |
| `financial_space_id` | `BIGINT` | NULL | FK space `RESTRICT`; must agree with resource/asset. |
| `user_avatar_user_id` | `BIGINT` | NULL | Explicit FK users `RESTRICT`. |
| `space_background_space_id` | `BIGINT` | NULL | Explicit FK financial spaces `RESTRICT`. |
| `bank_logo_bank_id` | `BIGINT` | NULL | Explicit FK banks `RESTRICT`. |
| `financial_transaction_id` | `BIGINT` | NULL | Explicit FK transactions `RESTRICT`. |
| `role` | `VARCHAR(64)` | NOT NULL | `AVATAR`, `BACKGROUND`, `EVIDENCE_IMAGE`, `LOGO`, etc. |
| `source_ordinal` | `INTEGER` | NOT NULL, `0` | Preserve image order; check >=0. |
| `status` | `attachment_status` | NOT NULL, `PENDING` | `PENDING`, `ACTIVE`, `REPLACED`, `REMOVED`, `REQUIRES_REVIEW`. |
| `linked_by_user_id` | `BIGINT` | NOT NULL | FK users `RESTRICT`. |
| `finalize_outbox_event_id` | `BIGINT` | NULL | FK outbox `RESTRICT`. |
| `activated_at` | `TIMESTAMPTZ` | NULL | Required active. |
| `removed_at` | `TIMESTAMPTZ` | NULL | Required removed/replaced. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL/default | Same transaction as resource link. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL/default | Lifecycle time. |

Check exactly one of the four explicit resource FKs is non-null. Unique active `(financial_transaction_id,role,source_ordinal)` plus unique active avatar/background/logo per explicit FK; indexes `(asset_id,status)`, `(financial_space_id,financial_transaction_id)`, `(status,created_at)`. Space/asset/resource ownership is enforced by constraint trigger and IDOR tests; no generic polymorphic resource key exists.

## Lifecycle guarantees

```text
provider upload -> TEMPORARY asset
business DB transaction -> PENDING attachment + outbox
worker confirms/finalizes -> ACTIVE asset/attachment
rollback/no link -> safe expiry cleanup after at least 24h
replace/remove -> outbox provider cleanup -> tombstone/audit
```

- Retry with the same idempotency/upload identity reuses the asset/link.
- Provider success before DB failure never deletes immediately; cleanup races re-check active attachments under lock.
- Four Wave 0 provider orphans remain `QUARANTINED`/`REQUIRES_REVIEW`; Wave 2 dry-run does not delete them.
- Application/job roles cannot hard-delete active assets/attachments; readonly role sees safe metadata without provider credentials.
