# Wave 2 Load Dependency Graph

Ngày review: 2026-08-02. Trạng thái: **REVIEWED cho W2-02**. Graph này định nghĩa dependency, two-pass relation resolution, checkpoint và reject boundary cho controlled dry-run/final full reload. Nó không chạy migration và không cấp quyền ghi production.

## 1. Pipeline boundary

```text
immutable source snapshot + manifest
  -> raw staging/archive
  -> validate scalar/type/identity
  -> load parent entities by graph level
  -> resolve deferred/self relations
  -> reconstruct approved financial postings
  -> reconcile counts/FKs/totals/balances/checksums
  -> discrepancy report and go/no-go
```

Mỗi run có `run_id`, source snapshot/checksum, mapping/rule/schema version, collection checkpoint và stable source `_id`. Cùng snapshot/version phải tạo cùng target/canonical hash. Resume dùng unique legacy ID/migration key và không tạo record/posting trùng.

## 2. Dependency levels

| Level | Load unit | Depends on | Source/input | Checkpoint before next level |
|---:|---|---|---|---|
| L0 | Migration run, raw immutable documents and field archive | none | all 26 source declarations + source manifest | Source counts/checksums and raw record hashes fixed; no source mutation |
| L1 | System reference seed | clean schema | approved bank/system-account seed catalog | Stable codes/public IDs unique; seed idempotent |
| L2 | Users | L0 | `users` | IDs/email/username/security state classified; duplicate identity blocking |
| L3 | Personal financial spaces | L2 | generated one per migrated user; `money_sources` owner evidence | Exactly one personal space/owner membership per user |
| L4 | Family financial spaces and memberships | L2 | `families.managerIds[]/memberIds[]` | Owner/manager/member refs resolve; overlaps/duplicates classified |
| L5 | Banks, contacts and categories without graph edges | L1, L3/L4 | `banks`, `contacts`, `categories` scalar/owner fields | Owner/space and bank codes resolve; category nodes loaded |
| L6 | Category graph edges | L5 | `childrenIds[]`, `parentIds[]` | Symmetry/self-edge/cycle/orphan report complete |
| L7 | Legacy money-source envelopes | L3/L4 | `money_sources` | Owner resolves; reverse arrays captured for later reconciliation, not loaded as authority |
| L8 | Accounts, accumulations and saving scalar rows + paired ledger accounts | L1, L3/L4, L5, L7 | `accounts`, `accumulations`, `savings_accounts` excluding deferred self/target refs | Each holder has one space and one ledger account; money/rate/time validation complete |
| L9 | Saving deferred relations | L8 | parent saving, funding target and interest target refs | No orphan/cycle; rollover cardinality classified |
| L10 | Budgets and allocations | L5/L6 | `budgets.categories[]` | Allocation/category ownership valid; embedded reverse IDs archived |
| L11 | Transaction headers | L2, L3/L4, L5/L6 | `transactions` | Actor/space/category/type/amount/time validate; one header identity each |
| L12 | Expense, income, transfer and contribution facts | L8, L11 | four active detail collections | Exactly one compatible detail per header; all typed money refs resolve |
| L13 | Debt origins | L5, L8, L11 | `loans`, `borrowings` | Counterparty/source/target resolve; rate value valid with explicit/default basis |
| L14 | Debt settlements | L13, L11 | `collections`, `repayments` | Original debt/contact/money ref resolve; amount allocation waits approved template |
| L15 | Notifications and recipient state | L2 | `notifications`, `user_notifications` | Parent FKs and composite duplicates classified |
| L16 | Assets and attachments | L2-L15 | avatar/background/logo/detail image paths + provider manifest | Provider identity/ownership or legacy-external state explicit; no deletion |
| L17 | Schema-only archive lane | L0 and optional relation lookup | 5 absent/empty schema-only collections | Any discovered row archived and discrepancy-created; no business posting/job |
| L18 | Financial posting reconstruction | L8, L11-L14 and W2-04 approved templates | opening facts, active detail facts, approved saving lifecycle facts | Every posting group balances; no unapproved fee/interest/settlement inference |
| L19 | Cached balance and bootstrap snapshot | L18 | stored balances + reconstructed ledger | 6/6 profiled holders rerun; exact tolerance 0 VND; mismatch creates BLOCKING case |
| L20 | Final reconciliation/discrepancy report | L0-L19 | counts, FKs, totals, ledger, assets and canonical hashes | 0 unclassified error; no unresolved BLOCKING for go/no-go |

Idempotency/outbox/session tables are schema infrastructure and begin empty at migration except explicitly approved session/security events. V1 access/refresh tokens and Agenda internal documents are never copied into them.

## 3. Source collection routing

| Source collection | Primary level | Deferred/reconciliation level | Route |
|---|---:|---:|---|
| `users` | L2 | L3/L16 | User, personal space, avatar |
| `families` | L4 | L16 | Family space, memberships, background asset |
| `banks` | L5/L1 | L16 | Bank reference; logo URL |
| `categories` | L5 | L6 | Category nodes then graph edges |
| `money_sources` | L7 | L8/L19 | Archive envelope and reconcile reverse refs |
| `accounts` | L8 | L18/L19 | Account + ledger account; opening/current balance evidence |
| `accumulations` | L8 | L18/L19 | Goal + ledger account; finish history |
| `savings_accounts` | L8 | L9/L18/L19 | Saving + ledger account; self/target refs then lifecycle postings |
| `transactions` | L11 | L12-L14/L18 | Header then typed facts/postings |
| `expenses` | L12 | L16/L18 | Expense fact, attachments, postings |
| `incomes` | L12 | L16/L18 | Income fact, attachments, postings |
| `transfers` | L12 | L16/L18 | Transfer fact, fee decision, attachments, postings |
| `contributions` | L12 | L16/L18 | Contribution fact, cross-space decision, attachments, postings |
| `loans` | L13 | L16/L18 | Receivable agreement/origin posting |
| `borrowings` | L13 | L16/L18 | Payable agreement/origin posting |
| `collections` | L14 | L16/L18 | Receivable settlement posting |
| `repayments` | L14 | L16/L18 | Payable settlement posting |
| `contacts` | L5 | L13/L14 | Space-scoped counterparties |
| `budgets` | L10 | L20 | Budget/allocation and derived-spend reconciliation |
| `notifications` | L15 | L20 | Notification content |
| `user_notifications` | L15 | L20 | Recipient/read state |
| `contribution_requests` | L17 | L20 | Archive-only unless later approved design |
| `group_payouts` | L17 | L20 | Archive-only; never emit posting |
| `invitations` | L17 | L20 | Archive-only |
| `proposal_expenses` | L17 | L20 | Archive-only; never emit posting |
| `system_tasks` | L17 | L20 | Archive-only; not Agenda store |

Coverage: 26/26 source-declared collections have one primary route and a reconciliation destination.

## 4. Deferred and cyclic relation handling

| Relation | Pass 1 | Pass 2 / failure |
|---|---|---|
| Category parent/child | Load all nodes with space | Build canonical directed edges; self/cycle/asymmetry/orphan becomes discrepancy |
| Saving parent rollover | Load saving scalar rows | Resolve parent after all savings exist; orphan/cycle/multiple child action blocks active lifecycle reconstruction |
| Money-source reverse arrays | Archive envelope/arrays | Compare child owner/envelope references; never overwrite child relation from array alone |
| Balance-holder transaction arrays | Archive arrays | Compare against canonical detail/header/posting effects; duplicate/orphan classified |
| Budget transaction arrays | Archive embedded arrays | Compare derived spend by category/UTC window; arrays never create transactions |
| Polymorphic money refs | Stage type and ID together | Resolve only after all holder types load; missing/invalid pair is blocking for financial record |
| Mixed debt contact BSON | Preserve raw BSON type | Convert only valid ObjectId/24-hex with existing same-space contact; otherwise discrepancy |
| Asset URL/provider ID | Preserve URL/path/index | Resolve provider manifest later; unknown provider identity becomes legacy external/review, not deletion |

## 5. Reject/discrepancy routing

| Reject code | Level | Severity/default action |
|---|---:|---|
| `INVALID_OR_DUPLICATE_LEGACY_ID` | L0-L2 | `BLOCKING` for any owned/financial record |
| `IDENTITY_BUSINESS_KEY_DUPLICATE` | L2 | `BLOCKING`; no automatic user merge |
| `UNRESOLVED_FINANCIAL_SPACE` | L3-L14 | `BLOCKING` |
| `UNRESOLVED_REFERENCE` | any relation level | Financial/ownership reference `BLOCKING`; otherwise `REQUIRES_REVIEW` |
| `CONFLICTING_REVERSE_RELATION` | L7/L19 | `BLOCKING` when balance/history changes, otherwise review |
| `INVALID_FINANCIAL_VALUE` | L8/L11-L14 | `BLOCKING` |
| `INVALID_OR_AMBIGUOUS_TIME` | L8/L10-L15 | Financial time `BLOCKING`; reminder/display time review |
| `MISSING_DUPLICATE_OR_WRONG_DETAIL` | L12-L14 | `BLOCKING` |
| `UNAPPROVED_POSTING_SEMANTICS` | L18 | `BLOCKING`; no posting emitted |
| `UNBALANCED_POSTING_GROUP` | L18 | `BLOCKING`; rollback target batch |
| `BALANCE_MISMATCH` | L19 | `BLOCKING` at tolerance 0 VND; no automatic adjustment |
| `SCHEMA_ONLY_RECORD_DISCOVERED` | L17 | `REQUIRES_REVIEW`; archive only |
| `ASSET_PROVIDER_ORPHAN_OR_UNKNOWN` | L16 | `REQUIRES_REVIEW`; quarantine/report, no delete |

## 6. Checkpoint/resume contract

1. A level starts only when all hard dependencies have successful immutable checkpoints.
2. Each batch stores source collection, last stable `_id`, source/target counts, rejected IDs, canonical hash and rule/schema version.
3. A resumed batch upserts by `legacy_mongo_id` or explicit migration key and verifies the prior canonical hash; changed input under the same snapshot ID is fatal.
4. Relation resolution and posting reconstruction have separate checkpoints so a rule change can rerun downstream levels without re-extracting source.
5. Financial posting idempotency key includes source snapshot, rule version, source transaction/detail identity and flow/action/period.
6. Reconciliation cannot mark a run successful while a level is partial or a `BLOCKING` case is unresolved.

## 7. Review record

- Mandatory parent-before-child order and two-pass cycles are explicit.
- 26/26 collections have a primary load/archive route.
- Agenda internal store, V1 token material and schema-only business behavior are excluded from blind copy.
- Posting reconstruction is structurally deferred until W2-04 templates are approved.
- No production database, V1 source behavior or V2 business runtime was changed.
