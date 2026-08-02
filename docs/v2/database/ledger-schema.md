# Ledger, System Accounts and Balance Snapshot Physical Schema

Ngày review: 2026-08-02. This schema is structural only; W2-04 approves posting definitions and Phase 4 implements transaction core.

## 1. `system_account_definitions`

| Column | PostgreSQL | Null/default | Rule |
|---|---|---|---|
| `id` | identity `BIGINT` | PK | Internal. |
| `public_id` | `UUID` | NOT NULL/default | Unique. |
| `code` | `VARCHAR(64)` | NOT NULL | Stable system role, seeded. |
| `normal_side` | `ledger_normal_side` | NOT NULL | `DEBIT` or `CREDIT`. |
| `allows_negative_balance` | `BOOLEAN` | NOT NULL | System role balance policy. |
| `description` | `TEXT` | NOT NULL | Reviewed accounting purpose. |
| `is_active` | `BOOLEAN` | NOT NULL, `TRUE` | Seed lifecycle. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time. |

Unique `code`; seed codes include `OPENING_EQUITY`, `MIGRATION_EQUITY`, `INCOME_CLEARING`, `EXPENSE_CLEARING`, `LOAN_RECEIVABLE`, `BORROWING_LIABILITY`, `INTEREST_EXPENSE`, `INTERSPACE_CLEARING`. Transfer fee has no system account/effect by DEC-065. Runtime cannot delete/rename codes.

### Reviewed Wave 2 seed registry

| Code | Normal side | Allows negative | Scope |
|---|---|---|---|
| `OPENING_EQUITY` | `CREDIT` | yes | Counter-account for explicit signed opening balance. |
| `MIGRATION_EQUITY` | `CREDIT` | yes | Audited migration anchor only; never an automatic reconciliation adjustment. |
| `INCOME_CLEARING` | `CREDIT` | yes | External income counter-account. |
| `EXPENSE_CLEARING` | `DEBIT` | no | External expense counter-account. |
| `LOAN_RECEIVABLE` | `DEBIT` | no | Outstanding loan principal. |
| `BORROWING_LIABILITY` | `CREDIT` | yes | Outstanding borrowing principal. |
| `INTEREST_EXPENSE` | `DEBIT` | yes | Explicit saving-interest recognition source. |
| `INTERSPACE_CLEARING` | `DEBIT` | yes | Space-local side of an atomic contribution group. |

The seed creates these eight global definitions, not a balance-bearing `ledger_accounts` row. One system ledger account per required role/financial space is generated during the controlled load after that space exists. The seed is idempotent and fails on an existing definition/template whose reviewed policy or canonical SHA-256 differs.

## 2. `posting_template_definitions`

| Column | PostgreSQL | Null/default | Rule |
|---|---|---|---|
| `id` | identity `BIGINT` | PK | Internal. |
| `public_id` | `UUID` | NOT NULL/default | Unique. |
| `code` | `VARCHAR(64)` | NOT NULL | Stable template code. |
| `version` | `INTEGER` | NOT NULL | Check >=1. |
| `status` | `posting_template_status` | NOT NULL | `APPROVED`, `RETIRED`; no DRAFT row may seed Wave 2 exit. |
| `definition_hash` | `CHAR(64)` | NOT NULL | SHA-256 canonical approved matrix row. |
| `effective_at` | `TIMESTAMPTZ` | NOT NULL | Approval/effective time. |
| `retired_at` | `TIMESTAMPTZ` | NULL | Required only for retired. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time. |

Unique `(code,version)` and partial unique current approved `code`; transaction FK uses an immutable row ID in the physical implementation even if API/core refers to code/version. Seed is blocked until W2-04 has 17/17 approved definitions.

## 2.1 `posting_template_entry_roles`

| Column | PostgreSQL | Null/default | Rule |
|---|---|---|---|
| `id` | identity `BIGINT` | PK | Internal. |
| `posting_template_definition_id` | `BIGINT` | NOT NULL | FK template definition `RESTRICT`. |
| `entry_role` | `VARCHAR(64)` | NOT NULL | Stable role referenced by ledger entry. |
| `required_account_kind` | `ledger_account_kind` | NOT NULL | User balance or system. |
| `required_system_role` | `VARCHAR(64)` | NULL | FK system definition code `RESTRICT`; required for system kind. |
| `sign_rule` | `posting_sign_rule` | NOT NULL | `POSITIVE`, `NEGATIVE`, `VARIABLE`. |
| `minimum_occurrences` | `SMALLINT` | NOT NULL, `1` | Check >=0. |
| `maximum_occurrences` | `SMALLINT` | NOT NULL, `1` | Check >= minimum. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time. |

Unique `(posting_template_definition_id,entry_role)`; index system role. Seed rows are generated only from W2-04 approved templates. Runtime cannot update/delete them.

## 3. `ledger_accounts`

| Column | PostgreSQL | Null/default | Rule/source |
|---|---|---|---|
| `id` | identity `BIGINT` | PK | Lock ordering authority. |
| `public_id` | `UUID` | NOT NULL/default | Unique API/admin ID. |
| `financial_space_id` | `BIGINT` | NOT NULL | FK spaces `RESTRICT`. |
| `kind` | `ledger_account_kind` | NOT NULL | `USER_BALANCE` or `SYSTEM`. |
| `normal_side` | `ledger_normal_side` | NOT NULL | Debit/credit accounting role. |
| `system_role` | `VARCHAR(64)` | NULL | FK system definition code `RESTRICT`; required for SYSTEM. |
| `account_id` | `BIGINT` | NULL | FK accounts `RESTRICT`. |
| `accumulation_id` | `BIGINT` | NULL | FK accumulations `RESTRICT`. |
| `saving_account_id` | `BIGINT` | NULL | FK savings `RESTRICT`. |
| `name` | `VARCHAR(256)` | NOT NULL | Display/admin label snapshot. |
| `current_balance` | `BIGINT` | NOT NULL, `0` | Cached projection, core-only write. |
| `current_sequence` | `BIGINT` | NOT NULL, `0` | Check >=0; assigned while row locked. |
| `allows_negative_balance` | `BOOLEAN` | NOT NULL, `FALSE` | DEC-031/system role policy. |
| `status` | `ledger_account_status` | NOT NULL, `ACTIVE` | `ACTIVE`, `BLOCKED`, `CLOSED`, `ARCHIVED`. |
| `closed_at` | `TIMESTAMPTZ` | NULL | Lifecycle. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time/source entity time. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL/default | Core/lifecycle time. |

Constraints:

- Unique `public_id`; unique non-null `account_id`, `accumulation_id`, `saving_account_id`.
- Exactly one domain FK for `USER_BALANCE`; no domain FK and one `system_role` for `SYSTEM`.
- Unique `(financial_space_id,system_role)` when system role non-null.
- Same-space trigger for domain FK; system-role normal side/negative policy matches definition.
- Checks current sequence/non-negative policy where applicable; user normal account can start negative only when allowed by account-opening policy, outgoing commands still cannot lower below zero.

Indexes: `(financial_space_id,status,id)` for deterministic locks, `(financial_space_id,kind,system_role)`. Delete `RESTRICT`; close/archive only.

## 4. `ledger_entries`

| Column | PostgreSQL | Null/default | Rule |
|---|---|---|---|
| `id` | identity `BIGINT` | PK | Immutable entry. |
| `public_id` | `UUID` | NOT NULL/default | Unique. |
| `financial_transaction_id` | `BIGINT` | NOT NULL | FK transaction `RESTRICT`. |
| `ledger_account_id` | `BIGINT` | NOT NULL | FK ledger account `RESTRICT`. |
| `account_sequence` | `BIGINT` | NOT NULL | Check >0, unique per ledger account. |
| `amount` | `BIGINT` | NOT NULL | Signed, `CHECK(amount <> 0)`. |
| `balance_before` | `BIGINT` | NOT NULL | Value while account row locked. |
| `balance_after` | `BIGINT` | NOT NULL | Check `balance_after=balance_before+amount`. |
| `posted_at` | `TIMESTAMPTZ` | NOT NULL, database-set | Must equal transaction posted time; client cannot supply/change. |
| `entry_role` | `VARCHAR(64)` | NOT NULL | Role in approved template, snapshot-safe. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time. |

Unique `(ledger_account_id,account_sequence)` and `(financial_transaction_id,ledger_account_id,entry_role)`; indexes `(financial_transaction_id,id)`, `(ledger_account_id,posted_at,account_sequence)`. Insert only while parent is DRAFT in the same DB transaction. Update/delete always denied by trigger. Same-space transaction/account trigger.

## 5. Database posting boundary

Versioned SQL migration installs deferrable constraint triggers:

1. Transition `DRAFT -> POSTED` sets `posted_at=clock_timestamp()` and is the only allowed posting transition.
2. At transaction end, every touched `financial_transactions` row must not remain `DRAFT`.
3. A `POSTED` row has at least two ledger entries and `SUM(ledger_entries.amount)=0` exactly.
4. All entries share transaction space, their `posted_at` equals parent `posted_at`, and their roles/kinds/signs/counts match `posting_template_entry_roles` for the transaction's immutable template version.
5. A reversal has one original, exact opposite entry set/account/amount, and unique `reverses_transaction_id` prevents a second full reversal.
6. Posted transaction business fields and all ledger entries reject update/delete. Status may change `POSTED -> REVERSED` only when the linked reversal is POSTED in the same boundary.

Phase 4 core still verifies invariants before the status transition; database constraints are the final guard, not a postings API for arbitrary service input.

`REVERSAL` reuses the original transaction's immutable posting-template definition for provenance, but the database skips the original positive/negative role rule and instead requires the complete entry set to be the exact sign-opposite of the original by `(ledger_account_id, entry_role)`. The original may transition to `REVERSED` only in the same boundary as that POSTED reversal. Contribution reversal additionally requires a second POSTED interspace group whose two transactions reverse the original pair.

## 6. `balance_snapshot_runs`

| Column | PostgreSQL | Null/default | Rule |
|---|---|---|---|
| `id` | identity `BIGINT` | PK | Run audit. |
| `public_id` | `UUID` | NOT NULL/default | Unique. |
| `financial_space_id` | `BIGINT` | NOT NULL | FK space `RESTRICT`. |
| `business_date` | `DATE` | NOT NULL | UTC date. |
| `trigger_type` | `snapshot_trigger_type` | NOT NULL | Scheduled/manual/catch-up/rebuild. |
| `status` | `snapshot_run_status` | NOT NULL | Pending/running/completed/failed/requires-review. |
| `calculation_version` | `INTEGER` | NOT NULL | Check >=1. |
| `idempotency_key` | `VARCHAR(200)` | NOT NULL | Unique. |
| `started_at` | `TIMESTAMPTZ` | NULL | Run start. |
| `completed_at` | `TIMESTAMPTZ` | NULL | Terminal time. |
| `accounts_total` | `INTEGER` | NOT NULL, `0` | Check >=0. |
| `accounts_succeeded` | `INTEGER` | NOT NULL, `0` | Check 0..total. |
| `accounts_failed` | `INTEGER` | NOT NULL, `0` | Check 0..total. |
| `error_summary` | `JSONB` | NULL | Redacted bounded summary. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time. |

Unique `(financial_space_id,business_date,calculation_version,trigger_type)` and `idempotency_key`; worker index `(status,business_date,id)`.

## 7. `account_balance_snapshots`

| Column | PostgreSQL | Null/default | Rule |
|---|---|---|---|
| `id` | identity `BIGINT` | PK | Versioned snapshot. |
| `public_id` | `UUID` | NOT NULL/default | Unique. |
| `snapshot_run_id` | `BIGINT` | NOT NULL | FK run `RESTRICT`. |
| `ledger_account_id` | `BIGINT` | NOT NULL | FK ledger `RESTRICT`. |
| `financial_space_id` | `BIGINT` | NOT NULL | FK space `RESTRICT`; same as ledger/run. |
| `business_date` | `DATE` | NOT NULL | UTC. |
| `period_start_utc` | `TIMESTAMPTZ` | NOT NULL | 00:00Z. |
| `period_end_utc` | `TIMESTAMPTZ` | NOT NULL | Next 00:00Z. |
| `opening_balance` | `BIGINT` | NOT NULL | Prior closing. |
| `total_inflow` | `BIGINT` | NOT NULL | Check >=0. |
| `total_outflow` | `BIGINT` | NOT NULL | Check >=0. |
| `closing_balance` | `BIGINT` | NOT NULL | Exact formula check. |
| `first_entry_sequence` | `BIGINT` | NULL | Null together on empty day. |
| `last_entry_sequence` | `BIGINT` | NULL | >= first. |
| `cutoff_sequence` | `BIGINT` | NOT NULL | Check >=0. |
| `cutoff_posted_at` | `TIMESTAMPTZ` | NOT NULL | Stable cutoff after lock. |
| `entry_count` | `INTEGER` | NOT NULL | Check >=0. |
| `calculation_version` | `INTEGER` | NOT NULL | Check >=1. |
| `checksum` | `CHAR(64)` | NOT NULL | Canonical metadata+entry-chain SHA-256. |
| `status` | `balance_snapshot_status` | NOT NULL | Valid/failed/stale/rebuilding/superseded. |
| `is_current` | `BOOLEAN` | NOT NULL, `FALSE` | One current account/date. |
| `superseded_by_id` | `BIGINT` | NULL | Self FK `RESTRICT`. |
| `superseded_at` | `TIMESTAMPTZ` | NULL | Required when superseded. |
| `generated_at` | `TIMESTAMPTZ` | NOT NULL | Calculation time. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL/default | Database time. |

Unique `(ledger_account_id,business_date,calculation_version)`; partial unique `(ledger_account_id,business_date) WHERE is_current`; indexes `(financial_space_id,business_date)`, `(status,business_date)`. Checks period is exactly one UTC day, closing formula, sequence/count/null coherence and supersession state. Update allowed only for controlled status/supersession transition; no delete.

## 8. Role/delete policy

- Application role can insert financial transactions/entries and update ledger projection only through transaction-core repository paths; SQL triggers enforce invariants.
- Job role may write snapshot tables and call the same application posting boundary for financial jobs, but cannot update/delete ledger entries.
- Readonly role selects ledger/snapshots through safe views; migration role owns DDL/seed.
- Every FK in this document uses `ON DELETE RESTRICT`; ledger/snapshot/system definition rows are never cascade-deleted.
