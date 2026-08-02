# Financial Invariant and Posting Template Matrix

## 1. Trạng thái và gate

Đây là posting contract đã được project owner duyệt cho Phase 3B2 ngày 2026-08-02 sau DEC-065..070. Phase 4 chỉ được thực thi đúng các template/version dưới đây; service không được tự tạo postings tùy ý.

## 2. Approval scope and evidence

- Evidence source: `financial-flows.md` (22 mutation sites), model schemas, routes and job handlers.
- **17/17 templates are `APPROVED`** and cover all inventoried balance mutations/lifecycle intents.
- Production profiling found 6 active balance-bearing records, all matching reconstructed history at `0 VND`; no current saving record exercises the interest templates. Four provider-orphan assets and four unversioned Agenda payloads are classified in the data-quality/job reports.
- Symbols: `A` amount, `P` principal/current principal, `I` interest, `B` opening balance. Signed postings must sum to zero. Approved system roles: `OPENING_EQUITY`, `MIGRATION_EQUITY`, `INCOME_CLEARING`, `EXPENSE_CLEARING`, `LOAN_RECEIVABLE`, `BORROWING_LIABILITY`, `INTEREST_EXPENSE`, `INTERSPACE_CLEARING`.

## 3. Financial invariant matrix

| Flow/entity | Invariant before | Invariant after | Balance/ownership policy | Concurrency/idempotency risk | Evidence V1 | Status |
|---|---|---|---|---|---|---|
| Normal account opening | authorized space/account; B is safe integer | B=0 creates no ledger rows; otherwise cached balance equals opening posting | signed opening allowed only here; actor owner/manager | permanent account-opening key | `accountService.js:13-114`; DEC-031/067 | APPROVED |
| Accumulation opening | authorized space; target >=0 | balance 0, active goal; no ledger rows | resource creation only | permanent resource-create key | `accumulationService.js:17-123`; DEC-067 | APPROVED |
| Saving opening/deposit | source/saving same space; A>0; source sufficient | source -A; saving +A; total 0 | source after >=0; saving non-negative | saving-opening key | `savingService.js:74-266`; family defect corrected by DEC-068 | APPROVED |
| Expense | source active/unblocked/authorized; A>0 | source -A; transaction immutable | source after >=0 | actor/key/hash and row lock | `expenseService.js`; DEC-067 | APPROVED |
| Income | target active/authorized; A>0 | target +A; immutable | no zero command | actor/key/hash | `incomeService.js`; DEC-067 | APPROVED |
| Transfer | same-space distinct accounts; A>0; source sufficient | source -A, target +A; fee metadata has no entry | source after >=0; fee nonnegative metadata | lock IDs ascending | `transferService.js`; DEC-065/067/070 | APPROVED |
| Contribution | personal source owner and active target-family member; A>0 | two linked locally balanced transactions through clearing | source after >=0; atomic group; spaces differ | group idempotency and ascending cross-space locks | `contributionService.js`; DEC-067/070 | APPROVED |
| Loan disbursement | authorized source/contact; A>0; source sufficient; explicit new rate basis | cash -A, receivable +A | source after >=0; legacy rate may be UNSPECIFIED | actor/key/hash | `loanService.js`; DEC-021/067 | APPROVED |
| Borrowing receipt | authorized target/contact; A>0; explicit new rate basis | cash +A, liability -A | target active; legacy rate may be UNSPECIFIED | actor/key/hash | `borrowingService.js`; DEC-021/067 | APPROVED |
| Repayment | payable open; A equals outstanding principal; source sufficient | cash -A; liability +A; debt settled | full principal only; interest=0; no UNSPECIFIED calculation | unique debt settlement operation key | `repaymentService.js`; DEC-066/067 | APPROVED |
| Collection | receivable open; A equals outstanding principal | cash +A; receivable -A; debt settled | full principal only; interest=0 | unique debt settlement operation key | `collectionSevice.js`; DEC-066/067 | APPROVED |
| Accumulation close | goal active/authorized; target same space | P>0: goal -P/target +P; P=0: lifecycle-only; goal closed zero | no zero ledger entry | goal+close key | `accumulationService.js:143-202`; DEC-067 | APPROVED |
| Saving interest monthly | active monthly saving; period due once; target same space | interest recognized and paid exactly once | UTC period, V1 month formula, HALF_UP final | saving+period key | `savingService.js:366-425`; DEC-021/032/069 | APPROVED |
| Saving interest maturity | active saving; maturity due once; target/action valid | interest recognized once and paid/retained by action | UTC and approved formula; no legacy inference without evidence | saving+maturity key | `savingService.js:513-571`; DEC-021/032/069 | APPROVED |
| Saving close | active/owned; target same space; calculation evidenced | explicit interest then full transfer; closed zero | saving never negative | saving+close key | `savingService.js:288-364`; DEC-069 | APPROVED |
| Rollover principal | old saving due/open; unique child | old -P; new +P; old closed zero | same space; P>0 | parent+period+action key | `savingService.js:427-511` | APPROVED |
| Rollover principal+interest | old saving due/open; unique child; I evidenced | recognize I; old -(P+I); new +(P+I) | same space; no unsupported legacy inference | parent+period+action key | `savingService.js:573-659`; DEC-069 | APPROVED |

Global invariants for every template: authorized financial space; amount parsed without JS precision loss; same explicit transaction context; accounts locked by increasing internal ID; transaction becomes POSTED only when postings sum zero; ledger entries and business snapshot immutable; cached balances equal ledger at current sequence; outbox commits with business write; retry reuses same idempotency result; correction uses full reversal.

## 4. Posting template matrix

| Template | Trigger | Approved signed postings | Preconditions/balance rule | Snapshot + idempotency | Legacy migration rule/tests | Status |
|---|---|---|---|---|---|---|
| `OPENING_BALANCE` | account create/migration | B>0: account `+B`, equity `-B`; B<0: account `-abs(B)`, equity `+abs(B)`; B=0 no rows | authorized; signed B only for normal account; `MIGRATION_EQUITY` requires approved anchor evidence | account/type/B/source checksum; account+opening-version key | V1 initBalance/stored balance; DEC-044; exact balance and duplicate tests | APPROVED |
| `ACCUMULATION_OPENING` | accumulation create/migration | no ledger rows | target >=0; authorized space; initial balance exactly 0 | goal/target/time; resource-create key | source balance/history nonzero mismatch is blocking | APPROVED |
| `INCOME` | HTTP/migration | target `+A`; `INCOME_CLEARING -A` | A>0; target same-space active/authorized | header/category/target/time/assets; actor+key | unique compatible income detail; rollback/retry/IDOR | APPROVED |
| `EXPENSE` | HTTP/migration | source `-A`; `EXPENSE_CLEARING +A` | A>0; source same-space active/unblocked; after >=0 | source/category/time/assets; actor+key | unique compatible expense detail; insufficient/concurrency | APPROVED |
| `TRANSFER` | HTTP/internal/migration | source `-A`; target `+A`; fee creates no entry | A>0; same space; distinct active accounts; source after >=0 | both accounts, fee metadata/reason; actor+key | fee preserved metadata-only DEC-065; lock/deadlock tests | APPROVED |
| `CONTRIBUTION` | HTTP/migration composite | source-space tx: source `-A`, source clearing `+A`; target-space tx: target clearing `-A`, target `+A` | A>0; source personal owner; target family active membership; both targets active; atomic group | both spaces/accounts/membership/request; group actor+key | V1 one header/detail maps to group + two tx; group rollback/reversal/concurrency tests | APPROVED |
| `LOAN_DISBURSEMENT` | HTTP/migration | cash source `-A`; `LOAN_RECEIVABLE +A` | A>0; source after >=0; borrower; new commands explicit rate basis | terms/contact/due/rate; actor+key | legacy rate basis `UNSPECIFIED`, no auto interest | APPROVED |
| `BORROWING` | HTTP/migration | cash target `+A`; `BORROWING_LIABILITY -A` | A>0; target/contact authorized; new commands explicit rate basis | terms/contact/due/rate; actor+key | legacy rate basis `UNSPECIFIED`, no auto interest | APPROVED |
| `REPAYMENT` | HTTP/migration | cash source `-P`; liability `+P` | P>0 equals outstanding principal; interest=0; source after >=0; debt PAYABLE open | original/principal/rate metadata/settlement; debt+full-repayment key | non-full or interest-ambiguous legacy settlement is blocking | APPROVED |
| `COLLECTION` | HTTP/migration | cash target `+P`; receivable `-P` | P>0 equals outstanding principal; interest=0; debt RECEIVABLE open | original/principal/rate metadata/settlement; debt+full-collection key | non-full or interest-ambiguous legacy settlement is blocking | APPROVED |
| `ACCUMULATION_CLOSE` | PATCH/internal/migration | P>0: accumulation `-P`, target `+P`; P=0 no ledger rows | owned/open; same-space target; P=current balance | goal/target/reason; goal+close key | transfer+finish must reconcile atomically; split mismatch blocking | APPROVED |
| `SAVING_DEPOSIT` | saving create/migration | source `-P`; saving `+P` | P>0; source after >=0; same space; saving starts zero | terms/bank/source/rates; saving-opening key | individual detail; family dispatcher defect is corrected, unsupported record blocks | APPROVED |
| `SAVING_INTEREST_MONTHLY` | Agenda/migration | `INTEREST_EXPENSE -I`; saving `+I`; saving `-I`; target `+I` | I>0; monthly period due once; same-space target; active saving | principal/rate/formula/period/rounding/target; saving+period key | only reconstruct with full deterministic evidence per DEC-069 | APPROVED |
| `SAVING_INTEREST_MATURITY` | Agenda/migration | recognize: `INTEREST_EXPENSE -I`, saving `+I`; payout when action requires: saving `-I`, target `+I` | I>0; maturity due once; target/action consistent | principal/rate/days-or-months/rounding/action; saving+maturity key | unsupported direct credit is blocking, never inferred from residual | APPROVED |
| `SAVING_CLOSE` | HTTP/job/migration | recognize `INTEREST_EXPENSE -I`, saving `+I`; saving `-(P+I)`, target `+(P+I)`; omit interest pair when I=0 | P>0; I>=0 evidenced; same-space target; saving active | calculation version/full inputs/reason; saving+close key | implicit legacy interest needs deterministic evidence; otherwise blocking | APPROVED |
| `SAVING_ROLLOVER_PRINCIPAL` | Agenda/migration | old saving `-P`; new saving `+P` | P>0; maturity/action due; same space; unique child | old/new/term/period; parent+period+action key | parentSavingId and balances exact; duplicate child blocking | APPROVED |
| `SAVING_ROLLOVER_PRINCIPAL_INTEREST` | Agenda/migration | recognize `INTEREST_EXPENSE -I`, old saving `+I`; old `-(P+I)`, new `+(P+I)` | P>0; I>0 evidenced; same space; unique child | full calculation + old/new/period; parent+period+action key | no residual-based interest inference; unsupported record blocking | APPROVED |

Lock order for every multi-account template: increasing V2 internal account ID. Full reversal creates a new POSTED transaction with exact opposite postings; original entries are not updated/deleted and a unique rule prevents a second full reversal.

## 5. Business decision closure

| Decision | Approved rule | Template impact |
|---|---|---|
| DEC-065 | Transfer fee is metadata-only. | `TRANSFER` has exactly two postings; no fee account. |
| DEC-066 | Full principal settlement only; automatic interest disabled. | `REPAYMENT`/`COLLECTION` require exact outstanding principal and post interest 0. |
| DEC-067 | Money-moving command amount >0; opening exceptions explicit. | No zero ledger rows; zero account/accumulation opening is resource-only. |
| DEC-068 | Family routes retained with corrected V2 semantics. | Same templates/policies apply to family space; V1 dispatcher defect is not reproduced. |
| DEC-069 | No unsupported direct saving-interest inference. | Missing deterministic calculation evidence is `BLOCKING`. |
| DEC-070 | Same-space transfer; controlled personal-to-family contribution. | Contribution is one atomic group with `CONTRIBUTION_OUT` and `CONTRIBUTION_IN` physical template versions. |

## 6. Test derivation status

Each template requires success, authorization/IDOR, invalid amount, insufficient balance, duplicate key/same-vs-different hash, rollback at every write, concurrent hot-account, deadlock retry, full reversal, asset failure and outbox failure tests as applicable. Scheduled templates additionally require duplicate dispatch, missed-run catch-up, UTC boundary and crash-after-commit tests.

V1 repo has no tests/fixtures; therefore columns are test requirements, not executed evidence.

## 7. Tiêu chí duyệt trước Phase 4

- 100% vị trí mutation tiền và financial jobs đã map vào template hoặc được ghi rõ là deprecated/archive-only.
- Mỗi template có postings cân bằng, account roles/system accounts và normal-side rõ ràng.
- Preconditions, authorization, balance policy, lock order và idempotency scope có thể chuyển thành test.
- Reversal không update/delete ledger gốc.
- Business snapshot fields đủ tái dựng quyết định tại thời điểm post.
- Legacy transaction có migration rule; trường hợp không thể ánh xạ tạo discrepancy, không tự adjustment.
- Transaction-core API chỉ nhận template đã duyệt, không cho service tự tạo postings tùy ý.

Phase 3B2 result: **17/17 APPROVED**, zero unresolved placeholder/status in cutover scope. Each row has source evidence, balanced postings or an explicit no-posting rule, authorization, balance policy, snapshot, idempotency, reversal and migration disposition. Phase 4 remains out of Wave 2 scope.
