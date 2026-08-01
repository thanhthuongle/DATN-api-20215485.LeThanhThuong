# V1 Financial Flows and Balance Mutation Inventory

Ngày inventory: 2026-08-01. Tài liệu mô tả hành vi source V1; không coi hành vi rủi ro là quy tắc V2 đã duyệt.

## 1. System understanding

V1 lưu `balance` trực tiếp trên ba collection: `accounts`, `accumulations`, `savings_accounts`. Một transaction có header trong `transactions` và detail trong collection theo type. `transactionService` cố điều phối header + detail + balance + reverse arrays trong MongoDB session, nhưng scheduled saving flows và một số close/finish paths có boundary khác.

Static scan xác định **22 active service call sites/direct assignments** thay đổi balance (không tính một dòng comment), quy về:

- sáu `$inc` primitives: increase/decrease trên account, accumulation, saving;
- `accumulationModel.finishAccumulation` set balance về 0;
- `savingsAccountModel.update` có thể set balance tùy ý và được bốn call sites dùng để set 0;
- initial balance được ghi khi create account/saving/accumulation.

Không có ledger, idempotency key, lock predicate/compare-and-set, reversal hoặc immutable balance-before/after snapshot trong V1.

## 2. Mutation call-site register

Mọi row có owner/status; không vị trí nào được coi là V2-approved.

| ID | Source evidence | Trigger/flow | Mutation | Boundary | Owner/status |
|---|---|---|---|---|---|
| BM-001 | `accountService.js:45` | create individual account | set `balance=initBalance` | Mongo transaction with money-source relation | accounts / INVENTORIED |
| BM-002 | `accountService.js:97` | create family account | set `balance=initBalance` | Mongo transaction | accounts / INVENTORIED |
| BM-003 | `savingService.js:122` | create individual saving | set saving balance 0, then transfer initial principal | shared Mongo transaction | savings / INVENTORIED |
| BM-004 | `savingService.js:218` | create family saving | set saving balance `initBalance` | Mongo transaction; subsequent dispatch has argument defect | savings / INVENTORIED |
| BM-005 | `expenseService.js:44` | expense | source `-amount` | caller Mongo transaction | transactions / INVENTORIED |
| BM-006 | `incomeService.js:38` | income | target `+amount` | caller Mongo transaction | transactions / INVENTORIED |
| BM-007 | `transferService.js:49` | transfer | source `-amount` | caller Mongo transaction | transactions / INVENTORIED |
| BM-008 | `transferService.js:50` | transfer | target `+amount` | same caller transaction | transactions / INVENTORIED |
| BM-009 | `loanService.js:49` | loan disbursement | source `-amount` | caller Mongo transaction | debt / INVENTORIED |
| BM-010 | `borrowingService.js:46` | borrowing | target `+amount` | caller Mongo transaction | debt / INVENTORIED |
| BM-011 | `repaymentService.js:62` | repayment | source `-amount` | caller Mongo transaction | debt / INVENTORIED |
| BM-012 | `collectionSevice.js:59` | debt collection | target `+amount` | caller Mongo transaction | debt / INVENTORIED |
| BM-013 | `contributionService.js:53` | family contribution | source `-amount` | caller Mongo transaction | contribution / INVENTORIED |
| BM-014 | `contributionService.js:54` | family contribution | target `+amount` | same caller transaction | contribution / INVENTORIED |
| BM-015 | `accumulationService.js:193` | finish accumulation | set balance 0 | **outside** transfer transaction | accumulations / INVENTORIED |
| BM-016 | `savingService.js:315` | manual close saving | saving `+calculatedInterest` | close Mongo transaction | savings / INVENTORIED |
| BM-017 | `savingService.js:342` | manual close saving | set saving balance 0 after transfer | same transaction | savings / INVENTORIED |
| BM-018 | `savingService.js:421` | receive monthly interest | saving `+interest` | **no session**, before separate transaction create | savings/jobs / INVENTORIED |
| BM-019 | `savingService.js:475` | roll over principal | set old saving balance 0 | outer Mongo transaction | savings/jobs / INVENTORIED |
| BM-020 | `savingService.js:567` | receive maturity interest | saving `+interest` | **no session**, before separate transaction create | savings/jobs / INVENTORIED |
| BM-021 | `savingService.js:600` | roll over principal+interest | old saving `+interest` | outer Mongo transaction | savings/jobs / INVENTORIED |
| BM-022 | `savingService.js:626` | roll over principal+interest | set old saving balance 0 | same transaction | savings/jobs / INVENTORIED |

Model enforcement evidence: `accountModel.js:55-84`, `accumulationModel.js:55-84,115-127`, `savingsAccountModel.js:103-134,166-177`. All `$inc` filters use only `_id`; insufficient-balance checks occur before update and are not part of an atomic predicate/lock.

## 3. Financial flow inventory

| Flow | Trigger | V1 balance effect | Header/detail/history | Preconditions/authorization evidenced | Atomicity/side effects | Migration interpretation/status |
|---|---|---|---|---|---|---|
| Account opening | POST account individual/family | stored account starts at arbitrary integer `initBalance`; individual validator permits negative | **no transaction header/detail** | individual actor from JWT; family manager middleware | account + money-source relation in Mongo transaction | opening balance must be a migration opening posting/anchor derived from account `initBalance`; DRAFT |
| Accumulation opening | POST accumulation | starts 0 by schema default | no transaction | owner/family manager | create + reverse array in transaction; reminder scheduled inside individual transaction | opening zero; DRAFT |
| Saving deposit/opening (individual) | POST saving | new saving 0; source `-initBalance`, saving `+initBalance` through transfer | transfer header/detail; both transactionIds arrays | source/interest target ownership checked | one outer session; Agenda scheduled after session | map as SAVING_DEPOSIT; DRAFT |
| Saving opening (family) | POST family saving | source intends `-initBalance`, saving intends `+initBalance`, but saving initially written with init balance | transfer header manually created | family manager route; service does not validate source owner | `transferService.createNew` called with 4 arguments although signature requires 5 | behavior BLOCKED/defect evidence; profile whether records exist |
| Expense | POST transaction type expense | source `-amount` | header + expenses detail + transactionId + budget refs | category owner checked for individual; source existence/block/balance; **source ownership absent** | intended same Mongo transaction; Cloudinary inside it | EXPENSE DRAFT; IDOR and external-side-effect risk |
| Income | type income | target `+amount` | header + incomes detail + target transactionId | target existence; **ownership absent** | same transaction; Cloudinary inside | INCOME DRAFT |
| Transfer | type transfer; internal saving/accumulation flows | source `-amount`, target `+amount`; `fee` ignored by mutations | header + transfers detail + both transactionId arrays | source existence/block/balance; target existence; **ownership/same-source check absent** | same transaction; Cloudinary inside | TRANSFER DRAFT; fee semantics OPEN |
| Loan disbursement | type loan | source `-amount` | header + loans detail + source transactionId | source exists/unblocked/sufficient, borrower exists; ownership absent | Mongo transaction, but Cloudinary and Agenda schedule happen before commit | LOAN_DISBURSEMENT DRAFT; rate basis unspecified |
| Borrowing | type borrowing | target `+amount` | header + borrowings detail + target transactionId | target/lender exist; ownership absent | Mongo transaction, Cloudinary/Agenda inside | BORROWING DRAFT |
| Repayment | type repayment | selected source `-request amount` | new header/detail links original borrowing | original owner checked, one prior repayment lookup, balance check | Mongo transaction; Cloudinary + Agenda cancel inside | REPAYMENT DRAFT; amount not evidenced equal debt principal/interest |
| Collection | type collect | selected target `+request amount` | new header/detail links original loan | original owner checked, one prior collection lookup | Mongo transaction; Cloudinary + Agenda cancel inside | COLLECTION DRAFT; amount not evidenced equal receivable |
| Contribution | type contribution | source `-amount`, target `+amount` | header/detail; transaction arrays switch omits contribution | only existence checks after detail insert; no source balance/block/ownership check | same transaction; Cloudinary inside | CONTRIBUTION DRAFT; double-spend/negative/IDOR risk |
| Finish accumulation | PATCH accumulation | if balance >0, transfer full balance to request target; then force balance 0/isFinish | transfer history created; status change no financial header | accumulation ownership; target existence; code forces target type to account in detail despite accepting lookup type | transfer commits in its own transaction, status/cancel occur later | ACCUMULATION_CLOSE DRAFT; status not atomic with transfer |
| Manual saving close | POST saving close | add calculated interest; transfer full balance+interest; set saving 0/closed | one transfer header; interest only implicit in resulting transfer amount | saving existence; **saving and target ownership are not checked** | Mongo transaction; Agenda cancel after session | SAVING_CLOSE/EARLY_CLOSE DRAFT; interest needs explicit posting |
| Monthly saving interest | Agenda solver | add monthly interest to saving, then transfer same interest to account | transfer header only; direct credit not represented | saving owner/status/type/stt and target fallback | first balance increment outside transaction; transaction follows | SAVING_INTEREST_MONTHLY DRAFT; retry can double-credit |
| Maturity interest payout | Agenda solver | add maturity interest, then transfer same interest | transfer header only | saving owner/status/type; target fallback | first increment outside transaction | SAVING_INTEREST_MATURITY DRAFT; retry can double-credit |
| Roll over principal | Agenda solver | transfer old principal into new saving, then set old 0/closed | new transfer and parentSavingId | owner/status/term policy/maturity time | outer Mongo transaction; next job scheduled after | SAVING_ROLLOVER_PRINCIPAL DRAFT |
| Roll over principal+interest | Agenda solver | old saving `+interest`; transfer total to new saving; old set 0 | transfer history, interest implicit | owner/status/term policy/maturity time | outer Mongo transaction; next job after | SAVING_ROLLOVER_PRINCIPAL_INTEREST DRAFT |

## 4. Transaction boundary and retry behavior

- HTTP individual transaction creation starts Mongo transaction unless given an external session; header, subtype detail, balance and reverse arrays are intended to commit together (`transactionService.js:121-224`).
- `runTransactionWithRetry` recursively repeats callback for `TransientTransactionError`; `commitWithRetry` recursively retries unknown commit result. Neither has bounded attempts/idempotency key (`mongoTransaction.js`). A replay can repeat Cloudinary/Agenda side effects inside the callback.
- Generic `createNew` and family `createFamilyTransaction` call subtype services with arguments inconsistent with every subtype signature `(userId, amount, dataDetail, images, {session})` (`transactionService.js:96-103,255-260`). Mounted generic/family endpoints therefore have a source-evidenced runtime defect until tests prove otherwise.
- No row/document lock or conditional `$inc` prevents two concurrent outgoing operations from both passing the pre-read balance check. Mongo snapshot transactions may abort one conflicting writer, but application retry has no idempotency and repeats the entire flow/side effects.

## 5. Critical financial integrity findings

| ID | Evidence-backed issue | Risk | Owner/required decision |
|---|---|---|---|
| FINV1-001 | Opening account balance has no history transaction. | reconstructed history cannot equal stored balance without opening baseline | Migration/transaction owner: explicit OPENING_BALANCE posting. |
| FINV1-002 | Interest is directly credited before/inside transfer and has no distinct financial transaction type. | history delta misses credited interest; retry may mint money | Savings owner: explicit interest posting and stable job idempotency. |
| FINV1-003 | Monthly/maturity interest direct increment is outside the following transaction. | failure leaves increased saving balance with no transfer/history | BLOCKING behavior class for reconstruction. |
| FINV1-004 | Balance checks are read-then-write and update filter only by `_id`; no idempotency. | concurrent overspend/double-post | V2 core requirement DEC-007/009/034. |
| FINV1-005 | Subtype services do not consistently authorize money-source owner/financial space. | IDOR and cross-owner balance mutation | Module policy owner; V2 authorization tests. |
| FINV1-006 | Cloudinary and Agenda calls occur within Mongo transactions/retry callbacks. | orphan/duplicate irreversible side effects on abort/retry | Outbox/asset/jobs owners per DEC-038/053. |
| FINV1-007 | Family/generic transaction dispatch signatures do not match subtype services. | mounted financial endpoints likely fail or misroute arguments | Transactions owner; capture production/frontend use before deprecate/fix decision. |
| FINV1-008 | Contribution lacks insufficient-balance/block checks. | negative balance and double-spend | Posting template must choose actual V2 rule; DEC-031 baseline favors no new outgoing negative. |
| FINV1-009 | Transfer `fee` is validated/stored but not applied to either balance. | fee history/accounting ambiguous | OPEN business decision with data count/examples. |
| FINV1-010 | Repayment/collection amount is the new transaction request amount, without source proof it matches original debt terms. | debt can be marked complete with arbitrary amount | Debt owner: define principal/interest/full settlement invariant. |

## 6. Balance reconstruction implications

Transaction history alone is insufficient. Per money source, candidate reconstruction must start with an opening component and add signed effects:

```text
account candidate = initBalance
  + income + borrowing + collection + incoming transfer/contribution
  - expense - loan - repayment - outgoing transfer/contribution

accumulation candidate = 0 + same signed detail effects

saving candidate = opening/deposit effects + explicit detail effects
  + inferred direct interest credits where evidence permits
```

However, migration must not silently infer interest or force equality. Direct-interest call sites and legacy records need separate discrepancy/rule classification. Exact algorithm and execution evidence belong to W0-04/data-quality report.

## 7. Review record

- Coverage: 22/22 active service mutation call sites/direct assignments are registered; all three balance-bearing collections and every subtype service were read.
- Flow coverage: eight V1 transaction types plus opening, accumulation close and five saving lifecycle variants are classified.
- Skill review focus: atomicity, ownership, rollback, idempotency, concurrency and external side effects were checked for every flow.
- Diff review: documentation only; no V1 financial logic or production behavior changed.
