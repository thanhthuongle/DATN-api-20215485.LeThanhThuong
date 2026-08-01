# Financial Invariant and Posting Template Matrix

## 1. Trạng thái và gate

Đây là khung deliverable, chưa phải mô tả nghiệp vụ cuối cùng. Phase 0 điền hành vi V1; Phase 3 chốt thiết kế V2. Phase 4 không được bắt đầu cho đến khi mọi financial flow trong inventory có dòng tương ứng được review.

## 2. Trạng thái Wave 0

- Evidence source: `financial-flows.md` (22 mutation sites), model schemas, routes and job handlers.
- **17 draft templates** cover all inventoried balance mutations/lifecycle intents. None is `APPROVED`.
- Production profiling found 6 active balance-bearing records, all matching reconstructed history at `0 VND`; no current saving record exercises the interest templates. Four provider-orphan assets and four unversioned Agenda payloads are classified in the data-quality/job reports.
- Symbols: `A` amount, `P` principal/current principal, `I` interest, `F` fee. Signed postings must sum to zero; system account names are proposals pending Phase 3 review.

## 3. Financial invariant matrix

| Flow/entity | Invariant before | Invariant after | Balance/ownership policy | Concurrency/idempotency risk | Evidence V1 | Status |
|---|---|---|---|---|---|---|
| Normal account opening | owner/space exists; opening amount integer | cached balance equals opening ledger posting | negative opening allowed; actor/manager owns target | V1 has no history/idempotency | `accountService.js:13-114` | DRAFT |
| Accumulation opening | owner/space exists; target >=0 | balance 0, active goal | non-negative; owner/manager | reverse-array duplicate | `accumulationService.js:17-123` | DRAFT |
| Saving opening/deposit | source and saving owner/space match; source sufficient | source decreases A; saving increases A; total postings 0 | source cannot fall below 0; saving non-negative | family dispatch defect; retry duplicates | `savingService.js:74-266` | DRAFT |
| Expense | source active/unblocked/sufficient and authorized | source decreases A; transaction immutable | outgoing cannot create negative | read-check/write race; no idempotency | `expenseService.js` | DRAFT |
| Income | target active and authorized | target increases A | amount integer/non-negative; zero policy open | retry double-credit | `incomeService.js` | DRAFT |
| Transfer | distinct authorized source/target; source sufficient | source -A, target +A; total 0 | no negative source; fee rule open | lock two accounts deterministically | `transferService.js` | DRAFT |
| Contribution | authorized individual source and family target; family relation valid | source -A, target +A | V1 lacks source balance/block/ownership check | negative/double-spend/IDOR | `contributionService.js` | DRAFT |
| Loan disbursement | authorized source, borrower, terms; sufficient funds | cash -A, receivable +A | rate basis explicit | job/upload inside retry | `loanService.js` | DRAFT |
| Borrowing receipt | authorized target/lender/terms | cash +A, liability -A | rate basis explicit | retry double-credit | `borrowingService.js` | DRAFT |
| Repayment | original borrowing open; actor owns it; settlement amount valid | cash -A; liability +A; original linked/settled per rule | cannot mark fully repaid for arbitrary amount | duplicate lookup not DB unique | `repaymentService.js` | DRAFT |
| Collection | original loan open; actor owns it; settlement amount valid | cash +A; receivable -A | cannot mark fully collected for arbitrary amount | duplicate lookup not DB unique | `collectionSevice.js` | DRAFT |
| Accumulation close | goal active; actor owns; target authorized | transfer full balance; goal closed at zero | source/target non-negative | V1 transfer/status split | `accumulationService.js:143-202` | DRAFT |
| Saving interest monthly | saving active, monthly period due once | interest recognized and paid/credited exactly once | UTC period; decimal/HALF_UP | V1 direct increment outside transaction | `savingService.js:366-425` | DRAFT |
| Saving interest maturity | saving active, maturity due once | interest recognized and paid exactly once | UTC period; ACTUAL/365/month rule | same | `savingService.js:513-571` | DRAFT |
| Saving close | saving active/owned; target owned; interest rule chosen | interest recognized; full balance transferred; saving closed at 0 | saving never negative | upload/job cancel and retry | `savingService.js:288-364` | DRAFT |
| Rollover principal | old saving due/open | P moves old->new; old closed 0; unique child | one rollover per parent/period | job duplicate can create child | `savingService.js:427-511` | DRAFT |
| Rollover principal+interest | old saving due/open | recognize I; P+I moves to new; old closed 0 | one rollover per parent/period | direct interest and duplicate job | `savingService.js:573-659` | DRAFT |

Global invariants for every draft: authorized financial space; amount parsed without JS precision loss; same explicit transaction context; accounts locked by increasing internal ID; transaction becomes POSTED only when postings sum zero; ledger entries and business snapshot immutable; cached balances equal ledger at current sequence; outbox commits with business write; retry reuses same idempotency result; correction uses full reversal.

## 4. Posting template matrix

| Template | Trigger | Draft signed postings | Preconditions/balance rule | Snapshot + idempotency | Legacy migration rule/tests | Status |
|---|---|---|---|---|---|---|
| `OPENING_BALANCE` | account create; migration | account `+B`; `OPENING_EQUITY` or approved `MIGRATION_EQUITY -B` | owner authorized; B integer; negative opening only normal account | account/type/B/provenance; key account+opening version | V1 `initBalance`; match DEC-044; test negative/large/duplicate | DRAFT |
| `ACCUMULATION_OPENING` | accumulation create | no posting when zero | target >=0; owner/space | goal snapshot; resource-create idempotency | migrate resource at zero, discrepancy if history implies otherwise | DRAFT |
| `INCOME` | HTTP | target `+A`; `INCOME_CLEARING -A` | target owned/active; amount >0 decision open | header/category/target/time; actor+key | incomes detail; missing detail blocking; rollback/retry tests | DRAFT |
| `EXPENSE` | HTTP | source `-A`; `EXPENSE_CLEARING +A` | source owned/active/unblocked; after >=0 | source/category/time/assets; actor+key | expenses; insufficient/IDOR/concurrency tests | DRAFT |
| `TRANSFER` | HTTP/internal | source `-A`; target `+A`; **F pending** | same space/allowed cross-space; source after>=0; source!=target | both accounts, fee, reason; actor+key | transfers; fee ambiguity discrepancy; two-lock/deadlock tests | DRAFT/OPEN_FEE |
| `CONTRIBUTION` | HTTP | source `-A`; family target `+A` | member/recipient/request policy; source after>=0 | family/request/actor; actor+key | contributions; cross-space authorization tests | DRAFT |
| `LOAN_DISBURSEMENT` | HTTP | cash source `-A`; `LOAN_RECEIVABLE +A` | source after>=0; borrower; rate basis | terms/borrower/due; actor+key | loans rate basis `UNSPECIFIED` when unproven | DRAFT |
| `BORROWING` | HTTP | cash target `+A`; `BORROWING_LIABILITY -A` | target/lender authorized; rate basis | terms/lender/due; actor+key | borrowings; type/rate tests | DRAFT |
| `REPAYMENT` | HTTP | cash source `-A`; liability `+A` | open amount >=A; full-vs-partial V2 scope must be decided; source after>=0 | original/terms/settlement; original+operation key | repayments; arbitrary V1 settlement creates discrepancy | DRAFT/OPEN_SETTLEMENT |
| `COLLECTION` | HTTP | cash target `+A`; receivable `-A` | open receivable >=A; settlement state rule | original/terms/settlement; original+operation key | collections; arbitrary V1 settlement discrepancy | DRAFT/OPEN_SETTLEMENT |
| `ACCUMULATION_CLOSE` | PATCH/internal | accumulation `-P`; target `+P` | owned/open; target authorized; P=current balance | goal/target/reason; goal+close key | transfer detail + finish state; split-boundary mismatch blocking | DRAFT |
| `SAVING_DEPOSIT` | saving create | source `-P`; saving `+P` | source after>=0; same owner/space; saving starts zero | terms/bank/source; saving-opening key | individual transfer; family records require defect profiling | DRAFT |
| `SAVING_INTEREST_MONTHLY` | Agenda | `INTEREST_EXPENSE -I`; saving `+I`; if payout: saving `-I`, target `+I` | period due once; saving active; target policy | rate/principal/days/period/rounding; saving+period key | infer only from approved evidence; retry/catch-up tests | DRAFT |
| `SAVING_INTEREST_MATURITY` | Agenda | `INTEREST_EXPENSE -I`; saving `+I`; optional payout saving `-I`, target `+I` | maturity due once | same + maturity action; saving+maturity key | direct V1 credits cause blocking mismatch | DRAFT |
| `SAVING_CLOSE` | HTTP/job | interest pair `-I/+I`; saving `-(P+I)`; target `+(P+I)` | owned/open; early/maturity formula; target owned | full calculation/provenance; saving+close key | close transfer + implicit interest; differential tests | DRAFT |
| `SAVING_ROLLOVER_PRINCIPAL` | Agenda | old saving `-P`; new saving `+P` | maturity, configured action, unique child | old/new/term; parent+period+action | parentSavingId; duplicate child checks | DRAFT |
| `SAVING_ROLLOVER_PRINCIPAL_INTEREST` | Agenda | interest `-I/+I`; old `-(P+I)`; new `+(P+I)` | same; unique child | calculation + old/new; parent+period+action | implicit V1 interest; reconstruction discrepancy | DRAFT |

Lock order for every multi-account template: increasing V2 internal account ID. Full reversal creates a new POSTED transaction with exact opposite postings; original entries are not updated/deleted and a unique rule prevents a second full reversal.

## 5. Open business decisions from inventory

| ID | Decision required | Blocks |
|---|---|---|
| OPEN-006 | Transfer fee: ignored as V1 balance behavior, charged additionally, or separate expense/system account? | TRANSFER approval/migration |
| OPEN-007 | Repayment/collection support only full settlement initially or explicit partial settlement? How is interest represented? | debt templates |
| OPEN-008 | Zero-amount financial command: V1 accepts amount >=0; V2 reject or preserve? | all command validators/templates |
| OPEN-009 | Family transaction endpoints appear broken by subtype call signature; deprecate/archive or preserve after traffic/frontend evidence? | family financial scope |
| OPEN-010 | Legacy saving direct-interest reconstruction and evidence sufficient to infer each credit. | balance reconciliation/migration |
| OPEN-011 | Cross-owner/cross-financial-space transfer/contribution policy. | authorization/postings |

Các quyết định này được đăng ký trong `decision-register.md` với trạng thái `Open`; task này không ngầm chuyển chúng thành `Accepted`.

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

Wave 0 result: coverage is complete at `DRAFT` level (17 templates) but **0/17 APPROVED**. Approval is intentionally deferred to Phase 3B2 after data profiling, business decisions and test derivation review.
