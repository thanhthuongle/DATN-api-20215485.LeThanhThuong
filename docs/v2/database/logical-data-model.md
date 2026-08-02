# V2 Logical Data Model

Ngày review: 2026-08-02. Trạng thái: **REVIEWED cho W2-01 / Phase 3A**. Tài liệu này chốt entity, ownership, aggregate boundary và quan hệ logic; kiểu PostgreSQL, tên column, index và delete policy thuộc W2-03. Quyết định migrate/transform/archive/drop từng field thuộc W2-02.

## 1. Phạm vi và evidence

Logical model được dựng từ toàn bộ 26 MongoDB schema khai báo trong `src/models`, enum tại `src/utils/constants.js`, inventory Wave 0 và các contract V2 đã duyệt:

- Identity/ownership: `userModel.js`, `familyModel.js`, `identity-auth-inventory.md`, `api-security-contracts.md`.
- Money holders: `moneySourceModel.js`, `accountModel.js`, `accumulationModel.js`, `savingsAccountModel.js`.
- Financial history: `transactionModel.js` và 8 detail models `expense`, `income`, `transfer`, `contribution`, `loan`, `borrowing`, `collection`, `repayment`; đối chiếu `financial-flows.md` và `financial-invariant-matrix.md`.
- Supporting domains: `bankModel.js`, `categoryModel.js`, `contactModel.js`, `budgetModel.js`, notification, family workflow và `systemTaskModel.js`.
- Integrity infrastructure: `transaction-core.md`, `transaction-runtime.md`, `periodic-balance-snapshots.md`, `admin-operations.md`, `job-scheduler.md`, `file-lifecycle-inventory.md`, `background-jobs.md`.

Không có source V2 business endpoint, transaction core hoặc balance mutation nào được triển khai trong task này. Logical model không coi các array reverse-reference của V1 là source of truth và không hợp thức hóa các hành vi V1 rủi ro.

## 2. Quy tắc identity và ownership

1. Mỗi entity public có ba identity độc lập: internal identity cho join, public UUID cho API và nullable legacy Mongo ID cho migration provenance. API không lộ internal identity hoặc ObjectId.
2. `User` là actor đăng nhập. `FinancialSpace` là ranh giới ownership/authorization của dữ liệu tài chính.
3. Mỗi user có một personal financial space; family V1 trở thành family financial space. Quan hệ user–space luôn đi qua `FinancialSpaceMembership`, không giữ `managerIds[]`/`memberIds[]` trên space.
4. Mọi account, category, contact, budget, debt, saving, transaction, ledger account, asset attachment và discrepancy nghiệp vụ phải resolve được tới đúng một financial space.
5. `responsiblePersonId` của V1 là actor/business participant của transaction, không thay thế membership check.
6. Quan hệ khác financial space bị từ chối mặc định. DEC-070 chỉ cho phép contribution personal-to-family với membership active và hai transaction space-local liên kết qua clearing; transfer thông thường luôn cùng space.

## 3. Context map

```text
Identity & Access
  User -> Session / TokenFamily
       -> FinancialSpaceMembership -> FinancialSpace

Financial Space
  FinancialSpace -> Account / AccumulationGoal / SavingAgreement
                 -> CategoryGraph / Budget / Contact
                 -> FinancialTransaction -> LedgerEntry -> LedgerAccount

Integrity & Delivery
  FinancialCommand -> IdempotencyRecord
  FinancialTransaction -> BusinessSnapshot / OutboxEvent / Attachment
  LedgerAccount -> DailyBalanceSnapshot
  Any governed resource -> AuditEvent / DiscrepancyCase

External adapters
  OutboxEvent -> notification/email/socket/asset finalization
  JobIntent -> JobScheduler adapter; handler -> service/core
```

## 4. Aggregate catalog

| Aggregate | Root và child entities | Ownership / authority | Logical invariant | Source evidence |
|---|---|---|---|---|
| Identity | `User`, `Session`, `TokenFamily` | User owns sessions; server owns token hashes/version/revocation | V2 session uses UUID subject, rotated refresh hash and family revocation; V1 token never migrates into a V2 session | `userModel.js`; `identity-auth-inventory.md`; DEC-042/047 |
| Financial space | `FinancialSpace`, `FinancialSpaceMembership` | Personal space has one owning user; family space has owner/manager/member memberships | Exactly one active owner; membership role is normalized; resource access requires active membership | `familyModel.js`; all `ownerType/ownerId` schemas |
| Institution | `Bank` | System reference data | Bank code is canonical; business resources reference it without copying ownership | `bankModel.js`; `seedBanks.js` |
| Category graph | `Category`, `CategoryEdge` | Exactly one financial space | Edge endpoints must share space; no self-edge/cycle; parent/child reverse arrays become one normalized edge relation | `categoryModel.js`; MDB graph inventory |
| Account | `Account`, paired `LedgerAccount` | Exactly one financial space | Cached balance is projection of immutable ledger; normal outgoing rule follows DEC-031; block/close state prevents writes | `accountModel.js`; BM-001/002/005..014 |
| Accumulation | `AccumulationGoal`, paired `LedgerAccount` | Exactly one financial space | Non-negative balance; finish is a financial transfer plus lifecycle transition, never an untracked set-to-zero | `accumulationModel.js`; BM-015 |
| Saving | `SavingAgreement`, `SavingPeriod`, paired `LedgerAccount` | Exactly one financial space | Principal/interest terms are immutable business facts; each period/action has stable identity; rollover links parent/child without rewriting history | `savingsAccountModel.js`; saving flows/jobs; DEC-021/032 |
| Contact | `Contact` | Exactly one financial space | Contact identity is space-scoped; same name is not global identity | `contactModel.js` |
| Budget | `Budget`, `BudgetAllocation` | Exactly one financial space | Window and allocations are normalized; spending is derived from qualifying transactions, not an authoritative transaction ID array | `budgetModel.js` |
| Financial transaction | `FinancialTransaction`, typed business facts, `BusinessSnapshot` | Exactly one financial space and responsible actor | Posted transaction is immutable; exactly one supported flow type; full reversal is a new linked transaction; amount semantics come from approved template | `transactionModel.js`; 8 detail models; DEC-024/050 |
| Debt | `DebtAgreement`, settlement links to financial transactions | Exactly one financial space; counterparty is a space contact | Direction distinguishes receivable/payable; principal, rate value/basis, due/reminder time and settlement state are explicit | loan/borrowing/collection/repayment models; DEC-021 |
| Ledger | `LedgerAccount`, `LedgerEntry` | Space-scoped; transaction core is sole writer | Sum entries per transaction is zero; entry balance chain and account sequence are immutable; cached balance equals ledger sum | `transaction-core.md`; DEC-024/034/041 |
| Daily snapshot | `BalanceSnapshotRun`, `AccountBalanceSnapshot` | Space-scoped system process | UTC `posted_at` cutoff, contiguous sequence/checksum, one current version per account/day/version | `periodic-balance-snapshots.md`; DEC-020/025 |
| Idempotency | `IdempotencyRecord` | Actor + financial space + operation scope | Same key/hash returns same result; same key/different hash conflicts; financial tombstone retained | `transaction-runtime.md`; DEC-034/051 |
| Outbox | `OutboxEvent`, consumer delivery receipt | Aggregate-scoped system process | Event is committed with business write; ordered, versioned, leased and at-least-once; ambiguous delivery is reviewable | `transaction-runtime.md`; DEC-051 |
| Asset | `TemporaryAsset`, `Attachment` | Actor and optional financial space | Provider upload precedes DB link; attachment is pending until post-commit finalization; URL alone never proves ownership | `file-lifecycle-inventory.md`; DEC-053 |
| Notification | `Notification`, `UserNotification` | Recipient user; business reference remains space-scoped | Read/receive state is normalized per recipient; delivery is an outbox side effect | notification models; `background-jobs.md` |
| Governance | `DiscrepancyCase`, `AuditEvent` | System/admin scope with resource linkage | Stable fingerprint deduplicates cases; blocking case gates cutover; audit is append-only; no direct ledger/balance edits | `admin-operations.md`; DEC-026/052 |
| Job intent | Versioned scheduler payload/stable key, not Agenda internal document | Owning module | Scheduler stores trigger intent only; financial handler calls transaction core with permanent idempotency | `background-jobs.md`; `job-scheduler.md`; DEC-038/045 |

## 5. Core entity responsibilities

### 5.1 Identity and access

| Entity | Business meaning | Required relationships/state |
|---|---|---|
| `User` | V2 identity/profile/settings | Email and username identities; active/security state; locale/currency/timezone/reminder preferences; no plaintext token material |
| `TokenFamily` | Refresh-token lineage and reuse boundary | Belongs to user; active/revoked/compromised state; family-wide revocation reason/time |
| `Session` | One refresh token generation/device session | Belongs to family/user; refresh-token hash, expiry, replacement/revocation metadata; access token is not persisted as session authority |
| `FinancialSpace` | Unified personal/family ownership boundary | Kind `PERSONAL` or `FAMILY`; display metadata; lifecycle; one owning membership |
| `FinancialSpaceMembership` | User role inside a space | Role `OWNER`, `MANAGER` or `MEMBER`; active interval; unique user/space membership |

The V1 `ownerType + ownerId` pair is migration evidence used to resolve a `FinancialSpace`; it is not retained as an unconstrained polymorphic owner in the target model.

### 5.2 Money holders and planning

| Entity | Business meaning | Required relationships/state |
|---|---|---|
| `Account` | Wallet, bank or other spendable account | Space, optional bank, display data, opening amount provenance, block/close lifecycle, paired ledger account |
| `AccumulationGoal` | Goal balance holder | Space, target amount, UTC start/end, active/finished lifecycle, paired ledger account |
| `SavingAgreement` | Term deposit/saving contract | Space, bank, funding and interest targets, rates, term/payment/end action, parent rollover, lifecycle, paired ledger account |
| `SavingPeriod` | Durable occurrence of monthly/maturity action | Saving, ordinal/business period, expected UTC boundary, action/status and stable idempotency identity |
| `Category` | Space-owned transaction classification | Space, name/type/icon/delete policy |
| `CategoryEdge` | Directed parent/child graph edge | Parent and child categories in same space; unique edge |
| `Contact` | Debt counterparty label/trust profile | Space-scoped, independent of system user identity |
| `Budget` | Time-bounded plan | Space, UTC window and lifecycle |
| `BudgetAllocation` | Category allocation inside budget | Budget/category, captured display provenance, amount and repeat policy; spend derived from transaction query |

`money_sources` is a V1 denormalized ownership envelope and reverse-index container. The target ownership boundary is `FinancialSpace`; accounts/savings/accumulations reference the space directly. Exact field dispositions are recorded in W2-02.

### 5.3 Transactions and debts

`FinancialTransaction` stores common immutable facts: flow type, space, actor/responsible person, category, business name/description, occurred time, database posted time, status, optional reversal link and versioned business snapshot. Flow-specific references live in typed fact records or explicit columns constrained by the physical specification; they are not free-form JSON postings supplied by services.

| Flow family | Logical facts beyond common transaction header |
|---|---|
| Expense/income | Source or target account; attachments |
| Transfer | Source, target and fee metadata/policy |
| Contribution | Atomic interspace group: personal source transaction, family target transaction, membership evidence and optional request provenance |
| Loan/borrowing | Direction, source/target account, counterparty, principal, rate value/basis and due/reminder intent |
| Collection/repayment | Original debt agreement, target/source account, settlement amount and actual occurrence time |
| Saving lifecycle | Saving, funding/interest target, period/action and parent/child rollover relation |
| Opening/migration/reversal | Account/system role, provenance/reason, original transaction where applicable |

`DebtAgreement` is created by a loan-disbursement or borrowing transaction. Collections/repayments link to the agreement and create their own immutable financial transactions. The logical model supports either full-only or partial settlement without guessing OPEN-007; the approved rule will decide constraints and state transitions before physical freeze.

### 5.4 Ledger and integrity infrastructure

| Entity | Responsibility |
|---|---|
| `LedgerAccount` | Accounting identity for one user-visible balance holder or an approved system role; owns current balance projection and sequence watermark |
| `LedgerEntry` | Immutable signed posting with before/after balance, per-account sequence and database posting time |
| `BusinessSnapshot` | Versioned immutable business labels/facts captured when posting; excludes credentials and unnecessary PII |
| `AccountBalanceSnapshot` | Versioned daily UTC checkpoint derived from ledger entries |
| `BalanceSnapshotRun` | Idempotent generation/rebuild/catch-up audit for a space/day/version |
| `IdempotencyRecord` | Command claim, semantic request hash, result/resource tombstone and terminal error metadata |
| `OutboxEvent` | Versioned after-commit delivery intent with aggregate ordering, lease and retry/review state |
| `DiscrepancyCase` | Structured migration/reconciliation/snapshot/outbox/job finding and resolution lifecycle |
| `AuditEvent` | Append-only security/admin/data-governance event with actor, action, reason and before/after-safe metadata |

System ledger accounts are explicit records, not magic balances. `MIGRATION_EQUITY` is the only migration-anchor counter-account and can be used only for an audited opening anchor allowed by DEC-044; it never hides an unresolved reconstruction mismatch.

### 5.5 Assets, notification and jobs

- `TemporaryAsset` holds provider identity, checksum, MIME, bytes, upload session, owner/space and expiry.
- `Attachment` links an asset to a governed entity with `PENDING`, `ACTIVE`, replacement/removal lifecycle and audit provenance.
- `Notification` is immutable content/business link; `UserNotification` owns recipient delivery/read state.
- Agenda internal records are infrastructure, not a PostgreSQL business aggregate. Only versioned job payload intent/stable identity is defined by the job registry.
- V1 `system_tasks` Joi schema is not used by its application and is not treated as the Agenda schema. Its migration disposition is decided field-by-field in W2-02.

## 6. Relationship and cardinality rules

| Relationship | Cardinality/rule |
|---|---|
| User–FinancialSpace | Many-to-many through memberships; one user owns exactly one personal space; family space has exactly one owner |
| Space–owned resource | One space to many; owned resource must not move silently between spaces |
| Account/Accumulation/Saving–LedgerAccount | Exactly one-to-one for each balance-bearing instance |
| FinancialTransaction–LedgerEntry | One-to-many; posting count at least two for a posted transaction |
| FinancialTransaction–reversal | Original has at most one full reversal; reversal references exactly one original and cannot reverse itself |
| DebtAgreement–settlement | One-to-many structurally; approved OPEN-007 policy constrains actual count/amount |
| Saving–SavingPeriod | One-to-many with unique saving/period/action stable identity |
| Saving rollover | Parent has at most one child for the same maturity action; no cycle |
| Category graph | Many-to-many directed edges inside one space; acyclic |
| Budget–Allocation | One-to-many; allocation references one category in the same space |
| Transaction–Attachment | One-to-many through normalized attachment; asset may be reused only under approved ownership policy |
| Aggregate–OutboxEvent | One-to-many ordered by aggregate sequence |
| Resource–DiscrepancyCase/AuditEvent | Optional typed linkage plus immutable evidence/provenance |

## 7. Lifecycle and retention rules

- Financial transactions, ledger entries, posted business snapshots and audit events are append-only; correction uses reversal/new audit event.
- Accounts, savings, accumulations and debts with financial history are closed/archived, never hard-deleted.
- A financial space with dependent financial history cannot be deleted; membership termination preserves historical actor linkage.
- Reference/configuration entities without financial history may be soft-deleted, subject to restrict when referenced.
- Idempotency financial identity and resource tombstone are retained permanently; response payload may expire under DEC-051.
- Temporary assets expire only when unreferenced; provider deletion happens after a safe period through outbox/job and retains evidence.
- Discrepancy `BLOCKING` cannot be ignored; no discrepancy workflow mutates ledger or cached balance directly.

## 8. Logical invariants handed to later tasks

| ID | Invariant |
|---|---|
| LDM-001 | Every governed business row resolves to one financial space or an explicit system/global scope. |
| LDM-002 | Every balance-bearing business resource has exactly one ledger account; only transaction core changes its cached balance. |
| LDM-003 | A posted financial transaction has immutable, balanced entries and immutable posting time. |
| LDM-004 | Owner/member/actor references are real user/membership relations, never unchecked ObjectId/string pairs. |
| LDM-005 | V1 arrays and embedded documents become normalized relations or archived provenance; none remains authoritative solely because V1 stored it. |
| LDM-006 | Money is VND integer; rates are decimal with explicit basis; all persisted financial time is UTC. |
| LDM-007 | External side effects occur after commit through versioned outbox/job intent; provider state is never part of a database transaction. |
| LDM-008 | Migration anchors require source provenance, reconciliation evidence and `MIGRATION_EQUITY`; no automatic balancing adjustment exists. |
| LDM-009 | Posted history, audit and reconciliation evidence use RESTRICT/append-only retention semantics. |
| LDM-010 | Public/API identity is UUID; legacy ObjectId exists only as nullable migration provenance. |

## 9. Phase 3 business decisions

Project owner resolved OPEN-006..011 through DEC-065..070 on 2026-08-02: fee metadata-only; full principal settlement without automatic interest; positive money-moving commands with opening exceptions; family endpoints retained and corrected; unsupported saving-interest inference blocked; ordinary transfer same-space and contribution handled as an atomic two-space clearing group. W2-03 incorporates these rules before posting approval.

## 10. W2-01 review record

- Coverage: 26/26 source-declared collection schemas represented by a target aggregate, supporting relation or explicit later disposition.
- Required domain coverage: users, sessions, spaces, memberships, accounts, debts, savings, budgets, financial transactions, ledger, snapshots, idempotency, outbox, discrepancy/audit and temporary assets.
- Ownership review: unconstrained V1 `ownerType/ownerId` is replaced by `FinancialSpace`; arrays/embedded data are normalized.
- Safety review: no production database access/write; no Prisma schema/migration; no V2 business source; no V1 behavior change.
- Next gate: W2-02 may open only after this document and progress diff pass review.
