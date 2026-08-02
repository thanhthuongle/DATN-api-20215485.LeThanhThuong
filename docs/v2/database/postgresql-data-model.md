# PostgreSQL V2 Data Model

Ngày review: 2026-08-02. Trạng thái: **REVIEWED cho W2-03**. `postgresql-table-specification.md` và các scoped schema documents là authoritative cho columns/constraints/indexes/delete policies; Prisma must conform to them, not the reverse.

## 1. Schema boundary

V2 uses one application schema (`public`) during initial Prisma rollout. Table ownership and grants provide isolation; introducing PostgreSQL schemas later requires a reviewed migration. All persisted timestamps are `TIMESTAMPTZ` UTC semantics and money is signed/non-negative `BIGINT` VND as specified per column.

```text
identity: users -> token_families -> sessions
ownership: users -> financial_space_memberships -> financial_spaces
domain: spaces -> categories/contacts/accounts/accumulations/savings/budgets
finance: spaces -> financial_transactions -> ledger_entries -> ledger_accounts
integrity: idempotency/outbox/snapshots/discrepancy/audit
assets: temporary_assets -> attachments -> governed resources
migration: migration_runs -> source_records/checkpoints/discrepancies
```

## 2. Table catalog and authority

| Domain | Tables | Authoritative specification |
|---|---|---|
| Identity/auth | `users`, `token_families`, `sessions` | `auth-session-schema.md` |
| Ownership | `financial_spaces`, `financial_space_memberships` | `postgresql-table-specification.md` |
| Reference/classification | `banks`, `categories`, `category_edges`, `contacts` | `postgresql-table-specification.md` |
| Balance holders/planning | `accounts`, `accumulations`, `savings_accounts`, `saving_periods`, `budgets`, `budget_allocations` | `postgresql-table-specification.md` |
| Transaction facts/debt | `financial_transactions`, three same-space basic detail tables, `interspace_transfer_groups`, `debt_agreements`, `debt_settlements`, `transaction_saving_details`, `migration_anchor_details` | `postgresql-table-specification.md` |
| Ledger/snapshots/system definitions | `system_account_definitions`, `posting_template_definitions`, `posting_template_entry_roles`, `ledger_accounts`, `ledger_entries`, `balance_snapshot_runs`, `account_balance_snapshots` | `ledger-schema.md` |
| Idempotency/delivery | `idempotency_records`, `outbox_events`, `outbox_delivery_attempts`, `inbox_receipts` | `outbox-idempotency-schema.md` |
| Assets | `temporary_assets`, `attachments` | `asset-attachment-schema.md` |
| Notifications | `notifications`, `user_notifications` | `postgresql-table-specification.md` |
| Governance/migration/flags | `discrepancy_cases`, `audit_events`, `migration_runs`, `migration_source_records`, `migration_checkpoints`, `feature_flag_overrides` | `discrepancy-audit-schema.md` |

## 3. Ownership joins

- Every financial/business aggregate carries `financial_space_id`; child rows inherit ownership through an FK and, where useful, also carry a direct space FK for authorization/indexing.
- A balance holder has exactly one `ledger_accounts` row, enforced by unique nullable domain FKs plus a discriminator/check constraint.
- Transaction detail tables use `ledger_account_id`, eliminating V1 source/target polymorphism. Attachments use an exactly-one set of explicit resource FKs rather than a free-form resource type/ID pair.
- Cross-space ledger entries are forbidden for one transaction. DEC-070 contribution uses one atomic `interspace_transfer_groups` command containing two linked, locally balanced transactions and space-local `INTERSPACE_CLEARING` accounts; ordinary transfer remains same-space only.
- Category graph edges and budget allocations require same-space parents; composite unique/FK or constraint triggers enforce where PostgreSQL cannot express the rule with a simple FK.

## 4. Query/index ownership

| Query family | Primary access path |
|---|---|
| Login/user identity | unique normalized email and username; active status |
| Session rotation/revocation | refresh hash unique; user/family/status/expiry |
| Space authorization | unique space/user membership; user/status/role index |
| Money-source replacement | holder list by `(financial_space_id, status, created_at, id)` |
| Transaction history | `(financial_space_id, occurred_at DESC, id DESC)` and category/type variants |
| Ledger rebuild | unique `(ledger_account_id, account_sequence)` and `(ledger_account_id, posted_at, account_sequence)` |
| Debt state | `(financial_space_id, direction, status, due_at)` and settlement debt/time |
| Saving jobs | unique saving/period/action; `(status, due_at)` |
| Budget spending | allocation category and budget time window; transaction space/category/occurred index |
| Outbox worker | status/next-attempt/aggregate sequence with lease indexes |
| Discrepancy queue | status/severity/source/detected time and stable fingerprint |
| Migration resume | unique run/collection/source key and collection checkpoint |

## 5. Deletion and immutability summary

- `CASCADE` is limited to ephemeral/auth child state or unposted/generated child rows whose parent deletion is safe (for example sessions under token family, category edges, unlinked temporary-asset metadata).
- Financial history, ledger, snapshots, debt, audit, discrepancy resolution and migration evidence use `RESTRICT` plus lifecycle/status fields.
- Posted transaction/ledger entry/audit rows are protected by database triggers from update/delete; reversal or a new audit event is the only correction.
- User/space deletion is soft-only after any membership/resource/history exists.

## 6. Roles

| Role | Intended privileges |
|---|---|
| `migration_role` | Own migrations; DDL and controlled migration DML; not used by runtime. |
| `application_role` | Runtime CRUD required by API/core; no DDL, role/database creation or bypass RLS; no direct hard-delete of financial/audit history. |
| `job_role` | Minimal read plus writes to job-owned outbox/snapshot/notification paths; financial mutations still call the same core boundary. |
| `readonly_role` | Read-only reporting/reconciliation views/tables; no sequence use or writes. |

`POSTGRESQL_DIRECT_URL` uses migration role and `POSTGRESQL_DATABASE_URL` uses application role. Job credentials are separate when a standalone worker is deployed. Secrets are only in ignored environment/secret manager.

## 7. Review gate

This model contains no V1 MongoDB model change and no V2 business implementation. W2-03 completes only when every catalog table has column, PK/FK/unique/index/check/delete/ownership rules in the scoped specifications and a cross-document consistency check passes.
