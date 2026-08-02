# Authoritative PostgreSQL Table Specification

Ngày review: 2026-08-02. Status: **REVIEWED cho W2-03**. This document plus the five scoped schema documents is the source of truth for Prisma and SQL migrations.

## 1. Reusable column profiles

Profiles below expand literally into every table that references them; they are not inheritance at runtime.

| Profile | Columns |
|---|---|
| `MIGRATED_ENTITY` | `id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`; `public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE`; `legacy_mongo_id CHAR(24) NULL UNIQUE`; `created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()`; `updated_at TIMESTAMPTZ NULL`; `deleted_at TIMESTAMPTZ NULL` |
| `GENERATED_ENTITY` | `id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`; `public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE`; `created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()`; `updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()` |
| `APPEND_ONLY_ENTITY` | `id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`; `public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE`; `created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()` |

All `legacy_mongo_id` values have `CHECK (legacy_mongo_id ~ '^[0-9a-fA-F]{24}$')`. API serializers expose `public_id`; internal IDs never cross the API boundary.

### Enum dictionary

| Enum | Values |
|---|---|
| `user_status` | `ACTIVE`, `INACTIVE`, `LOCKED`, `DELETED` |
| `week_day` | `MONDAY`..`SUNDAY` |
| `token_family_status` | `ACTIVE`, `REVOKED`, `COMPROMISED`, `EXPIRED` |
| `session_status` | `ACTIVE`, `ROTATED`, `REVOKED`, `EXPIRED` |
| `financial_space_kind` | `PERSONAL`, `FAMILY` |
| `financial_space_status` | `ACTIVE`, `SUSPENDED`, `ARCHIVED` |
| `membership_role` | `OWNER`, `MANAGER`, `MEMBER` |
| `membership_status` | `ACTIVE`, `SUSPENDED`, `LEFT` |
| `category_transaction_type` | `EXPENSE`, `INCOME`, `LOAN`, `COLLECT`, `BORROWING`, `REPAYMENT`, `TRANSFER`, `CONTRIBUTION` |
| `financial_transaction_type` | `ACCOUNT_OPENING`, `ACCUMULATION_OPENING`, `INCOME`, `EXPENSE`, `TRANSFER`, `CONTRIBUTION`, `LOAN_DISBURSEMENT`, `BORROWING`, `REPAYMENT`, `COLLECTION`, `ACCUMULATION_CLOSE`, `SAVING_DEPOSIT`, `SAVING_INTEREST_MONTHLY`, `SAVING_INTEREST_MATURITY`, `SAVING_CLOSE`, `SAVING_ROLLOVER_PRINCIPAL`, `SAVING_ROLLOVER_PRINCIPAL_INTEREST`, `REVERSAL` |
| `trust_level` | `NORMAL`, `GOOD`, `WARNING`, `BAD` |
| `account_type` | `WALLET`, `BANK`, `OTHER` |
| `account_status` | `ACTIVE`, `BLOCKED`, `CLOSED`, `ARCHIVED` |
| `accumulation_status` | `ACTIVE`, `FINISHED`, `ARCHIVED` |
| `saving_interest_schedule` | `MATURITY`, `MONTHLY` |
| `saving_maturity_action` | `CLOSE_ACCOUNT`, `ROLL_OVER_PRINCIPAL`, `ROLL_OVER_PRINCIPAL_AND_INTEREST` |
| `interest_day_count_convention` | `ACTUAL_365` |
| `money_rounding_mode` | `HALF_UP` |
| `saving_status` | `ACTIVE`, `CLOSED`, `ROLLED_OVER`, `ARCHIVED` |
| `saving_period_action` | `MONTHLY_INTEREST`, `MATURITY_INTEREST`, `CLOSE`, `ROLLOVER_PRINCIPAL`, `ROLLOVER_PRINCIPAL_INTEREST` |
| `saving_period_status` | `PENDING`, `PROCESSING`, `COMPLETED`, `CANCELLED`, `REQUIRES_REVIEW` |
| `saving_transaction_action` | `DEPOSIT`, `MONTHLY_INTEREST`, `MATURITY_INTEREST`, `CLOSE`, `ROLLOVER_PRINCIPAL`, `ROLLOVER_PRINCIPAL_INTEREST` |
| `budget_status` | `ACTIVE`, `CLOSED`, `ARCHIVED` |
| `financial_transaction_status` | `DRAFT`, `POSTED`, `REVERSED` |
| `interspace_transfer_status` | `DRAFT`, `POSTED`, `REVERSED` |
| `debt_direction` | `RECEIVABLE`, `PAYABLE` |
| `debt_rate_basis` | `ANNUAL_PERCENT`, `MONTHLY_PERCENT`, `FIXED_AMOUNT`, `UNSPECIFIED` |
| `debt_status` | `OPEN`, `PARTIALLY_SETTLED`, `SETTLED`, `WRITTEN_OFF`, `ARCHIVED` |
| `notification_type` | `LINK`, `TEXT`, `INVITATION` |
| `ledger_normal_side` | `DEBIT`, `CREDIT` |
| `ledger_account_kind` | `USER_BALANCE`, `SYSTEM` |
| `ledger_account_status` | `ACTIVE`, `BLOCKED`, `CLOSED`, `ARCHIVED` |
| `posting_template_status` | `APPROVED`, `RETIRED` |
| `posting_sign_rule` | `POSITIVE`, `NEGATIVE`, `VARIABLE` |
| `snapshot_trigger_type` | `SCHEDULED`, `MANUAL`, `CATCH_UP`, `REBUILD` |
| `snapshot_run_status` | `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `REQUIRES_REVIEW` |
| `balance_snapshot_status` | `VALID`, `FAILED`, `STALE`, `REBUILDING`, `SUPERSEDED` |
| `idempotency_actor_type` | `USER`, `JOB`, `ADMIN`, `MIGRATION` |
| `idempotency_status` | `IN_PROGRESS`, `COMPLETED`, `FAILED_FINAL` |
| `outbox_status` | `PENDING`, `PROCESSING`, `DELIVERED`, `DEAD_LETTER`, `REQUIRES_REVIEW` |
| `delivery_attempt_status` | `STARTED`, `SUCCEEDED`, `FAILED`, `UNKNOWN` |
| `asset_provider` | `CLOUDINARY`, `LEGACY_EXTERNAL`, `TEST` |
| `temporary_asset_status` | `TEMPORARY`, `LINKED`, `ACTIVE`, `EXPIRED`, `QUARANTINED`, `DELETED`, `REQUIRES_REVIEW` |
| `attachment_status` | `PENDING`, `ACTIVE`, `REPLACED`, `REMOVED`, `REQUIRES_REVIEW` |
| `migration_run_type` | `SAMPLE`, `DRY_RUN`, `REHEARSAL`, `FINAL` |
| `migration_run_status` | `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `BLOCKED` |
| `migration_record_disposition` | `STAGED`, `LOADED`, `ARCHIVED`, `REJECTED` |
| `checkpoint_status` | `PENDING`, `RUNNING`, `COMPLETED`, `FAILED` |
| `discrepancy_source` | `MIGRATION`, `RECONCILIATION`, `SNAPSHOT`, `OUTBOX`, `JOB` |
| `discrepancy_severity` | `BLOCKING`, `REQUIRES_REVIEW`, `AUTO_FIX_SAFE`, `INFO` |
| `discrepancy_status` | `OPEN`, `INVESTIGATING`, `RESOLVED`, `IGNORED` |
| `audit_actor_type` | `USER`, `ADMIN`, `JOB`, `MIGRATION`, `SYSTEM` |

## 2. Ownership and membership

### `financial_spaces` — `MIGRATED_ENTITY`

| Column | Type | Null/default | Source/rule |
|---|---|---|---|
| `kind` | `financial_space_kind` | NOT NULL | `PERSONAL` or `FAMILY`. |
| `name` | `VARCHAR(256)` | NOT NULL | Family name or generated personal display name. |
| `status` | `financial_space_status` | NOT NULL, `ACTIVE` | `ACTIVE`, `SUSPENDED`, `ARCHIVED`. |
| `background_attachment_id` | `BIGINT` | NULL | FK attachments, deferred circular FK, `ON DELETE SET NULL`. |

Rules: unique partial personal owner is enforced through memberships; index `(kind,status,id)` and `(status,created_at,id)`. Hard delete is `RESTRICT` once any owned resource/history exists.

### `financial_space_memberships` — `GENERATED_ENTITY`

| Column | Type | Null/default | Rule |
|---|---|---|---|
| `financial_space_id` | `BIGINT` | NOT NULL | FK spaces `ON DELETE RESTRICT`. |
| `user_id` | `BIGINT` | NOT NULL | FK users `ON DELETE RESTRICT`. |
| `role` | `membership_role` | NOT NULL | `OWNER`, `MANAGER`, `MEMBER`. |
| `status` | `membership_status` | NOT NULL, `ACTIVE` | `ACTIVE`, `SUSPENDED`, `LEFT`. |
| `joined_at` | `TIMESTAMPTZ` | NOT NULL | Legacy family/user creation or run time with provenance. |
| `ended_at` | `TIMESTAMPTZ` | NULL | Required for `LEFT`. |
| `source_ref` | `JSONB` | NULL | Family source field/index provenance; no secrets. |

Constraints: unique `(financial_space_id,user_id)`; partial unique one active `OWNER` per space; partial unique one active `PERSONAL` ownership per user enforced by constraint trigger. Index `(user_id,status,role,financial_space_id)`. Membership history is soft/status-only.

## 3. Reference and classification

### `banks` — `MIGRATED_ENTITY`

| Column | Type | Null/default | Source/rule |
|---|---|---|---|
| `code` | `VARCHAR(60)` | NOT NULL | Uppercase canonical V1 code. |
| `name` | `VARCHAR(120)` | NOT NULL | V1 name. |
| `logo_url` | `TEXT` | NULL | Legacy/external URL. |
| `is_active` | `BOOLEAN` | NOT NULL, `TRUE` | Derived lifecycle. |

Unique `code`; index `(is_active,code)`; referenced banks `ON DELETE RESTRICT`.

### `categories` — `MIGRATED_ENTITY`

| Column | Type | Null/default | Source/rule |
|---|---|---|---|
| `financial_space_id` | `BIGINT` | NOT NULL | FK spaces `ON DELETE RESTRICT`. |
| `name` | `VARCHAR(256)` | NOT NULL | V1 name. |
| `transaction_type` | `category_transaction_type` | NOT NULL | V1 category type canonicalized. |
| `is_system_locked` | `BOOLEAN` | NOT NULL, `FALSE` | Inverse/explicit form of allowDelete. |
| `icon` | `TEXT` | NULL | V1 icon. |

Unique active business key `(financial_space_id,transaction_type,name)` is case-normalized through `lower(name)` partial index. Index `(financial_space_id,transaction_type,deleted_at,id)`. FK use `RESTRICT`; deletion is soft.

### `category_edges` — `GENERATED_ENTITY`

| Column | Type | Null/default | Rule |
|---|---|---|---|
| `financial_space_id` | `BIGINT` | NOT NULL | FK space `RESTRICT`. |
| `parent_category_id` | `BIGINT` | NOT NULL | FK category `RESTRICT`. |
| `child_category_id` | `BIGINT` | NOT NULL | FK category `RESTRICT`. |
| `source_ref` | `JSONB` | NULL | Array path/index provenance. |

Unique `(parent_category_id,child_category_id)`; check parent != child; same-space and acyclic graph enforced by trigger/load validator. Index child and `(financial_space_id,parent_category_id)`.

### `contacts` — `MIGRATED_ENTITY`

| Column | Type | Null/default | Source/rule |
|---|---|---|---|
| `financial_space_id` | `BIGINT` | NOT NULL | FK space `RESTRICT`. |
| `name` | `VARCHAR(120)` | NOT NULL | V1 name. |
| `trust_level` | `trust_level` | NOT NULL, `NORMAL` | `NORMAL`, `GOOD`, `WARNING`, `BAD`. |

Index `(financial_space_id,deleted_at,lower(name),id)`; no automatic same-name merge. Debt FK `RESTRICT`, soft delete only when referenced.

## 4. Balance holders and planning

### `accounts` — `MIGRATED_ENTITY`

| Column | Type | Null/default | Source/rule |
|---|---|---|---|
| `financial_space_id` | `BIGINT` | NOT NULL | FK space `RESTRICT`. |
| `bank_id` | `BIGINT` | NULL | FK bank `RESTRICT`. |
| `type` | `account_type` | NOT NULL | `WALLET`, `BANK`, `OTHER`; maps `orther`. |
| `name` | `VARCHAR(256)` | NOT NULL | V1 accountName. |
| `description` | `TEXT` | NULL | V1 description. |
| `icon` | `TEXT` | NULL | V1 icon. |
| `status` | `account_status` | NOT NULL, `ACTIVE` | `ACTIVE`, `BLOCKED`, `CLOSED`, `ARCHIVED`. |
| `legacy_initial_balance` | `BIGINT` | NOT NULL | Source initBalance evidence; not ledger authority. |
| `legacy_stored_balance` | `BIGINT` | NOT NULL | Freeze/source balance evidence. |
| `closed_at` | `TIMESTAMPTZ` | NULL | Lifecycle. |

Checks status/closed time; index `(financial_space_id,status,created_at,id)`, bank lookup. One paired ledger account via unique ledger FK. Delete `RESTRICT`, lifecycle only.

### `accumulations` — `MIGRATED_ENTITY`

| Column | Type | Null/default | Source/rule |
|---|---|---|---|
| `financial_space_id` | `BIGINT` | NOT NULL | FK space `RESTRICT`. |
| `name` | `VARCHAR(256)` | NOT NULL | V1 name. |
| `description` | `TEXT` | NULL | V1 description. |
| `target_amount` | `BIGINT` | NOT NULL | Check >=0. |
| `legacy_stored_balance` | `BIGINT` | NOT NULL | Check >=0; reconciliation evidence. |
| `starts_at` | `TIMESTAMPTZ` | NOT NULL | UTC. |
| `ends_at` | `TIMESTAMPTZ` | NOT NULL | UTC, >= start. |
| `status` | `accumulation_status` | NOT NULL, `ACTIVE` | `ACTIVE`, `FINISHED`, `ARCHIVED`. |
| `finished_at` | `TIMESTAMPTZ` | NULL | Lifecycle. |

Index `(financial_space_id,status,ends_at,id)`; delete `RESTRICT`; paired ledger account unique.

### `savings_accounts` — `MIGRATED_ENTITY`

| Column | Type | Null/default | Source/rule |
|---|---|---|---|
| `financial_space_id` | `BIGINT` | NOT NULL | FK space `RESTRICT`. |
| `bank_id` | `BIGINT` | NOT NULL | FK bank `RESTRICT`. |
| `name` | `VARCHAR(256)` | NOT NULL | V1 name. |
| `description` | `TEXT` | NULL | V1 description. |
| `principal_amount` | `BIGINT` | NOT NULL | V1 initBalance; check >=0. |
| `legacy_stored_balance` | `BIGINT` | NOT NULL | Check >=0; migration evidence. |
| `annual_rate` | `NUMERIC(7,4)` | NOT NULL | Percent, 0..100. |
| `non_term_annual_rate` | `NUMERIC(7,4)` | NOT NULL | Percent, 0..100. |
| `day_count_convention` | `interest_day_count_convention` | NOT NULL, `ACTUAL_365` | Immutable saving calculation rule. |
| `rounding_mode` | `money_rounding_mode` | NOT NULL, `HALF_UP` | Round once at final VND result. |
| `starts_at` | `TIMESTAMPTZ` | NOT NULL | Canonical UTC with provenance. |
| `term_months` | `INTEGER` | NOT NULL | Check >=1. |
| `interest_schedule` | `saving_interest_schedule` | NOT NULL | `MATURITY`, `MONTHLY`. |
| `maturity_action` | `saving_maturity_action` | NOT NULL | Close/rollover variants. |
| `funding_ledger_account_id` | `BIGINT` | NOT NULL | FK ledger account `RESTRICT`; same-space trigger. |
| `interest_target_ledger_account_id` | `BIGINT` | NULL | FK ledger account `RESTRICT`; required by schedule/action rule. |
| `parent_saving_id` | `BIGINT` | NULL | Self FK `RESTRICT`. |
| `status` | `saving_status` | NOT NULL, `ACTIVE` | `ACTIVE`, `CLOSED`, `ROLLED_OVER`, `ARCHIVED`. |
| `closed_at` | `TIMESTAMPTZ` | NULL | Lifecycle. |

Unique partial `(parent_saving_id)` for one child per approved rollover action; self/cycle check trigger. Index `(financial_space_id,status,starts_at,id)` and `(status,starts_at,term_months)`. History `RESTRICT`.

### `saving_periods` — `GENERATED_ENTITY`

| Column | Type | Null/default | Rule |
|---|---|---|---|
| `saving_account_id` | `BIGINT` | NOT NULL | FK saving `RESTRICT`. |
| `period_ordinal` | `INTEGER` | NOT NULL | Check >=1. |
| `action` | `saving_period_action` | NOT NULL | Interest/maturity/rollover/close. |
| `due_at` | `TIMESTAMPTZ` | NOT NULL | UTC scheduler target. |
| `status` | `saving_period_status` | NOT NULL, `PENDING` | `PENDING`, `PROCESSING`, `COMPLETED`, `CANCELLED`, `REQUIRES_REVIEW`. |
| `financial_transaction_id` | `BIGINT` | NULL | FK transaction `RESTRICT`, set on completion. |
| `idempotency_key` | `VARCHAR(200)` | NOT NULL | Permanent stable period key. |
| `completed_at` | `TIMESTAMPTZ` | NULL | Required for completed. |

Unique `(saving_account_id,period_ordinal,action)` and `idempotency_key`; worker index `(status,due_at,id)`.

### `budgets` — `MIGRATED_ENTITY`

Columns: `financial_space_id BIGINT NOT NULL` FK `RESTRICT`; `starts_at TIMESTAMPTZ NOT NULL`; `ends_at TIMESTAMPTZ NOT NULL`; `status budget_status NOT NULL DEFAULT 'ACTIVE'`. Check end >= start. Index `(financial_space_id,status,starts_at,ends_at,id)`. Delete soft/RESTRICT.

### `budget_allocations` — `GENERATED_ENTITY`

Columns: `budget_id BIGINT NOT NULL` FK `RESTRICT`; `category_id BIGINT NOT NULL` FK `RESTRICT`; `source_ordinal INTEGER NOT NULL`; `category_name_snapshot VARCHAR(256) NOT NULL`; `icon_snapshot TEXT NULL`; `amount BIGINT NOT NULL CHECK(amount>=0)`; `repeat_enabled BOOLEAN NOT NULL DEFAULT FALSE`; `source_ref JSONB NULL`. Unique `(budget_id,category_id)` and `(budget_id,source_ordinal)`; index category. Same-space trigger.

## 5. Financial transactions and typed facts

### `financial_transactions` — `MIGRATED_ENTITY`, append-only after posting

| Column | Type | Null/default | Source/rule |
|---|---|---|---|
| `financial_space_id` | `BIGINT` | NOT NULL | FK space `RESTRICT`. |
| `posting_template_definition_id` | `BIGINT` | NOT NULL | FK immutable approved template version `RESTRICT`. |
| `type` | `financial_transaction_type` | NOT NULL | Canonical flow/read type. |
| `status` | `financial_transaction_status` | NOT NULL, `DRAFT` | `DRAFT`, `POSTED`, `REVERSED`; DRAFT cannot survive commit. |
| `responsible_user_id` | `BIGINT` | NOT NULL | FK users `RESTRICT`; active membership at command time. |
| `category_id` | `BIGINT` | NULL | FK category `RESTRICT`, same space. |
| `name` | `VARCHAR(256)` | NOT NULL | V1/header or system label. |
| `description` | `VARCHAR(256)` | NULL | V1 description. |
| `amount` | `BIGINT` | NOT NULL | Money-moving types require >0; account opening may be signed/zero and accumulation opening is zero-only per DEC-067. |
| `occurred_at` | `TIMESTAMPTZ` | NOT NULL | Business occurrence UTC. |
| `posted_at` | `TIMESTAMPTZ` | NULL | Database trigger sets on POSTED; immutable. |
| `reverses_transaction_id` | `BIGINT` | NULL | Self FK `RESTRICT`; unique when non-null. |
| `business_snapshot` | `JSONB` | NOT NULL | Versioned immutable facts, default forbidden at POSTED. |
| `snapshot_schema_version` | `INTEGER` | NOT NULL | Check >=1. |
| `idempotency_record_id` | `BIGINT` | NULL | FK idempotency record `RESTRICT`; unique for financial command. |
| `correlation_id` | `UUID` | NOT NULL | Request/job trace. |

Indexes: `(financial_space_id,occurred_at DESC,id DESC)`, `(financial_space_id,type,occurred_at DESC,id DESC)`, `(financial_space_id,category_id,occurred_at DESC,id DESC)`, `(posted_at,id)`, reversal unique. Posted rows and entries immutable by trigger; delete always denied when POSTED/REVERSED.

### Typed fact tables

All use `MIGRATED_ENTITY`, `financial_transaction_id BIGINT NOT NULL UNIQUE` FK transaction `RESTRICT`, and owner-space consistency trigger.

| Table | Additional columns | Checks/indexes/delete |
|---|---|---|
| `transaction_expense_details` | `source_ledger_account_id BIGINT NOT NULL` FK ledger; | compatible transaction type; source index; `RESTRICT`. |
| `transaction_income_details` | `target_ledger_account_id BIGINT NOT NULL` FK ledger; | compatible type; target index; `RESTRICT`. |
| `transaction_transfer_details` | `source_ledger_account_id BIGINT NOT NULL`; `target_ledger_account_id BIGINT NOT NULL`; `fee_amount BIGINT NULL CHECK(fee_amount>=0)` | source != target; both indexes; fee postings governed by OPEN-006; `RESTRICT`. |

### `interspace_transfer_groups` — `MIGRATED_ENTITY`, contribution-only in initial V2

| Column | Type | Null/default | Rule |
|---|---|---|---|
| `source_financial_space_id` | `BIGINT` | NOT NULL | Personal space FK `RESTRICT`. |
| `target_financial_space_id` | `BIGINT` | NOT NULL | Family space FK `RESTRICT`; must differ from source. |
| `actor_user_id` | `BIGINT` | NOT NULL | FK user `RESTRICT`; owns source and active member of target. |
| `source_ledger_account_id` | `BIGINT` | NOT NULL | FK source user-balance ledger `RESTRICT`. |
| `target_ledger_account_id` | `BIGINT` | NOT NULL | FK target user-balance ledger `RESTRICT`. |
| `source_transaction_id` | `BIGINT` | NOT NULL | Unique FK source-space contribution transaction `RESTRICT`. |
| `target_transaction_id` | `BIGINT` | NOT NULL | Unique FK target-space contribution transaction `RESTRICT`. |
| `amount` | `BIGINT` | NOT NULL | Check >0. |
| `status` | `interspace_transfer_status` | NOT NULL, `DRAFT` | Both linked transactions transition atomically. |
| `idempotency_record_id` | `BIGINT` | NOT NULL | Unique FK command idempotency `RESTRICT`. |
| `legacy_transaction_mongo_id` | `CHAR(24)` | NULL | V1 contribution header identity; unique. |
| `legacy_contribution_request_id` | `CHAR(24)` | NULL | Optional archived request provenance. |
| `correlation_id` | `UUID` | NOT NULL | Shared trace. |

Constraint trigger verifies DEC-070 membership, account/space ownership, both transactions use approved `CONTRIBUTION_OUT`/`CONTRIBUTION_IN` template versions, amounts agree and each transaction balances through the space-local `INTERSPACE_CLEARING`. Group cannot remain DRAFT after commit; reversal posts and links two opposite transactions atomically. Index source/target space/time and actor/time; delete `RESTRICT`.

### `debt_agreements` — `MIGRATED_ENTITY`

| Column | Type | Null/default | Rule |
|---|---|---|---|
| `financial_space_id` | `BIGINT` | NOT NULL | FK space `RESTRICT`. |
| `origin_transaction_id` | `BIGINT` | NOT NULL | Unique FK transaction `RESTRICT`. |
| `direction` | `debt_direction` | NOT NULL | `RECEIVABLE` loan or `PAYABLE` borrowing. |
| `cash_ledger_account_id` | `BIGINT` | NOT NULL | Source/target cash account FK `RESTRICT`. |
| `debt_ledger_account_id` | `BIGINT` | NOT NULL | System-role receivable/liability ledger FK. |
| `counterparty_contact_id` | `BIGINT` | NOT NULL | FK contact `RESTRICT`. |
| `principal_amount` | `BIGINT` | NOT NULL | Check >0 after OPEN-008 approval; physical base check >=0. |
| `rate_value` | `NUMERIC(7,4)` | NULL | Percentage value; legacy `UNSPECIFIED` may preserve raw rate but core must not calculate it. |
| `fixed_interest_amount` | `BIGINT` | NULL | VND, check >=0; required only for `FIXED_AMOUNT`. |
| `rate_basis` | `debt_rate_basis` | NOT NULL | Annual/monthly/fixed/unspecified; legacy defaults UNSPECIFIED. |
| `due_at` | `TIMESTAMPTZ` | NULL | Reminder/business due UTC. |
| `trust_level` | `trust_level` | NOT NULL, `NORMAL` | Origin snapshot. |
| `status` | `debt_status` | NOT NULL, `OPEN` | `OPEN`, `PARTIALLY_SETTLED`, `SETTLED`, `WRITTEN_OFF`, `ARCHIVED`. |
| `outstanding_principal` | `BIGINT` | NOT NULL | Projection, check 0..principal; core-only write. |
| `outstanding_interest` | `BIGINT` | NOT NULL, `0` | Check >=0; explicit interest only. |
| `settled_at` | `TIMESTAMPTZ` | NULL | Required for settled. |

Rate-basis checks: annual/monthly require rate and forbid fixed amount; fixed requires fixed amount and forbids rate; unspecified forbids fixed amount and is legacy-only, with any preserved raw rate non-calculating. Index `(financial_space_id,direction,status,due_at,id)`, counterparty/status. Delete `RESTRICT`.

### `debt_settlements` — `MIGRATED_ENTITY`

Columns: `financial_space_id BIGINT NOT NULL`; `financial_transaction_id BIGINT NOT NULL UNIQUE`; `debt_agreement_id BIGINT NOT NULL`; `cash_ledger_account_id BIGINT NOT NULL`; `principal_amount BIGINT NOT NULL CHECK(principal_amount>=0)`; `interest_amount BIGINT NOT NULL DEFAULT 0 CHECK(interest_amount>=0)`; `occurred_at TIMESTAMPTZ NOT NULL`; all FKs `RESTRICT`. Check principal+interest equals transaction amount through constraint trigger. Unique/full-vs-partial behavior follows OPEN-007 without schema rewrite. Index `(debt_agreement_id,occurred_at,id)`.

### `transaction_saving_details` — `GENERATED_ENTITY`

Columns: `financial_transaction_id BIGINT NOT NULL UNIQUE`; `saving_account_id BIGINT NOT NULL`; `saving_period_id BIGINT NULL`; `action saving_transaction_action NOT NULL`; `source_ledger_account_id BIGINT NULL`; `target_ledger_account_id BIGINT NULL`; `principal_amount BIGINT NOT NULL DEFAULT 0 CHECK>=0`; `interest_amount BIGINT NOT NULL DEFAULT 0 CHECK>=0`; `calculation_snapshot JSONB NOT NULL`; `calculation_version INTEGER NOT NULL CHECK>=1`; FKs `RESTRICT`. Unique `(saving_period_id,action)` when period non-null; indexes saving/action. Exact required accounts/postings come from approved template.

### `migration_anchor_details` — `GENERATED_ENTITY`

Columns: `financial_transaction_id BIGINT NOT NULL UNIQUE`; `ledger_account_id BIGINT NOT NULL`; `migration_run_id BIGINT NOT NULL`; `discrepancy_case_id BIGINT NULL`; `source_legacy_balance BIGINT NOT NULL`; `reconstructed_balance BIGINT NOT NULL`; `difference_amount BIGINT NOT NULL`; `source_checksum CHAR(64) NOT NULL`; `approval_actor_user_id BIGINT NOT NULL`; `approval_reason TEXT NOT NULL`; `approved_at TIMESTAMPTZ NOT NULL`; all FKs `RESTRICT`. Check difference = source - reconstructed and nonzero. Every anchor posts against `MIGRATION_EQUITY`; no implicit row creation.

## 6. Notifications

### `notifications` — `MIGRATED_ENTITY`

Columns: `type notification_type NOT NULL`; `title VARCHAR(256) NOT NULL`; `message TEXT NOT NULL`; `link TEXT NULL`; `financial_space_id BIGINT NULL` FK `RESTRICT`; `source_outbox_event_id BIGINT NULL` FK `RESTRICT`. Index `(financial_space_id,created_at DESC,id DESC)`. Content immutable after delivery; soft archive.

### `user_notifications` — `MIGRATED_ENTITY`

Columns: `user_id BIGINT NOT NULL` FK `RESTRICT`; `notification_id BIGINT NOT NULL` FK `RESTRICT`; `is_read BOOLEAN NOT NULL DEFAULT FALSE`; `received_at TIMESTAMPTZ NOT NULL`; `read_at TIMESTAMPTZ NULL`. Unique `(user_id,notification_id)`; check read state/time; index `(user_id,is_read,received_at DESC,id DESC)`. `ON DELETE RESTRICT` preserves delivery audit.

## 7. Cross-table checks not expressible as simple Prisma relations

Versioned SQL migrations must implement:

1. Same-space checks for membership-owned children, category edges, budget allocations, transaction details, debts and saving targets.
2. Exactly one paired domain owner for each non-system ledger account.
3. Posted transaction balance/immutability and DRAFT-not-after-commit gate from `ledger-schema.md`.
4. Category cycle prevention and saving parent cycle prevention.
5. Session family/user consistency and financial transaction membership/actor snapshot precondition.
6. Interest rate basis conditional constraints.

Prisma schema may model enums/relations/indexes but must not omit raw SQL checks, partial unique indexes, grants or triggers.

## 8. Authoritative FK/delete policy matrix

| Child relations | Parent | `ON DELETE` | Reason |
|---|---|---|---|
| user avatar; space background | attachments | `SET NULL` | Removing/replacing presentation link must not delete identity/space. |
| token families -> user; sessions -> family/user | auth parents | `CASCADE` | Ephemeral credential state only; governed user hard delete remains operationally blocked. |
| session replacement | sessions | `RESTRICT` | Preserve rotation chain. |
| memberships | users/spaces | `RESTRICT` | Preserve ownership history. |
| categories/contacts/accounts/accumulations/savings/budgets | spaces | `RESTRICT` | Space-owned history/configuration. |
| category edges | spaces/categories | `RESTRICT` | Graph deletion is explicit before category soft-delete. |
| accounts/savings | banks | `RESTRICT` | Reference history. |
| savings funding/interest target; all transaction money refs | ledger accounts | `RESTRICT` | Financial provenance. |
| savings parent | savings | `RESTRICT` | Rollover lineage. |
| saving periods | savings/financial transactions | `RESTRICT` | Durable job/financial idempotency. |
| budget allocations | budgets/categories | `RESTRICT` | Planning provenance. |
| financial transactions | space/template/user/category/original/idempotency | `RESTRICT` | Immutable posting authority/history. |
| typed transaction facts/interspace groups | transactions/ledger accounts/spaces/users/idempotency | `RESTRICT` | Immutable business facts and linked contribution atomicity. |
| debt agreements | space/origin transaction/ledger accounts/contact | `RESTRICT` | Receivable/payable history. |
| debt settlements | space/transaction/debt/ledger account | `RESTRICT` | Settlement history. |
| saving transaction facts | transaction/saving/period/ledger accounts | `RESTRICT` | Interest/rollover provenance. |
| migration anchor facts | transaction/ledger/run/discrepancy/user | `RESTRICT` | Audited adjustment evidence. |
| ledger accounts/entries/snapshots | all parents | `RESTRICT` | Ledger and checkpoint immutability. |
| idempotency/outbox/delivery/inbox | all parents | `RESTRICT` | Replay/delivery tombstones. |
| assets/attachments | users/spaces/banks/transactions/outbox | `RESTRICT` | Lifecycle/ownership evidence. |
| notifications/user notifications | users/spaces/outbox/notification | `RESTRICT` | Delivery/read history. |
| migration/discrepancy/audit/flags | all parents | `RESTRICT` | Governance evidence. |

No financial, audit, discrepancy, outbox, idempotency or migration-evidence FK uses cascade. Hard delete is denied by triggers/policies for posted/append-only rows; lifecycle columns handle normal removal.

## 9. Database roles and grants

| Object group | `migration_role` | `application_role` | `job_role` | `readonly_role` |
|---|---|---|---|---|
| Schema/migrations/types/functions | owner/DDL | `USAGE`, execute approved functions only | `USAGE`, execute approved worker/core functions | `USAGE` |
| Business/reference/auth tables | controlled DML | required select/insert/update; delete only ephemeral auth rows | minimum select needed by handler; no direct financial DML | safe select views |
| Financial transaction/ledger | migration load + DDL | insert/update through reviewed repository/function boundary; no entry delete | no direct ledger DML; financial handler invokes same core boundary | safe read |
| Snapshot tables | migration/DDL | read/admin-trigger metadata | select/insert/status update, no delete | read |
| Idempotency/outbox | migration/DDL | claim/business insert/update required | outbox claim/attempt/receipt DML | safe read without sensitive payload |
| Asset/notification | migration/DDL | owned application DML, no hard delete | finalize/delivery/status DML | safe read |
| Migration raw/checkpoints | full controlled DML | none | none | redacted aggregate views only |
| Discrepancy/audit | DDL/load | case workflow insert/update; audit insert only | owned case/audit insert | redacted read |

Migration SQL must `REVOKE CREATE ON SCHEMA public FROM PUBLIC`, revoke all table/sequence privileges from PUBLIC, set safe default privileges, and grant sequences only where insert is allowed. Neither runtime role owns tables, creates schema/database/roles, bypasses row security nor has superuser. Initial release uses application authorization plus same-space constraints rather than PostgreSQL per-user RLS; service credentials are never exposed to frontend.

## 10. W2-03 review record

- 45/45 target tables are present across this document and the scoped auth/ledger/outbox/asset/discrepancy specifications.
- 52 enum types have explicit values; debt fixed amount/rate basis and saving ACTUAL/365 + HALF_UP rules match `interest-rate-rules.md`.
- Money/balance columns use `BIGINT`; percentage rates use `NUMERIC(7,4)`; no `FLOAT`, `REAL` or `DOUBLE PRECISION` type exists.
- PK/public/legacy identity profiles, FK/delete matrix, unique/check/index plans, same-space ownership, append-only triggers and four least-privilege roles are explicit.
- Attachment targets use explicit FKs; transaction details use ledger-account FKs; no unconstrained ownership polymorphism or ID array remains.
- Prisma/raw SQL implementation is intentionally deferred to W2-05 after W2-04 posting approval.
