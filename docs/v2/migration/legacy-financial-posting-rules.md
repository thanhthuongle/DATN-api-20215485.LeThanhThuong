# Approved Legacy Financial Posting Rules

Ngày duyệt: 2026-08-02. Status: **APPROVED — W2-04**. Tài liệu này định tuyến V1 creation/history/lifecycle evidence sang 17 business posting templates. Nó không tự tạo adjustment hoặc thực thi migration.

## 1. Global reconstruction contract

```text
source snapshot + source record/detail identity + rule version
-> validate owner/space/type/time/money/reference
-> build approved template command
-> produce balanced entries or explicit no-posting result
-> compare reconstructed balance with stored balance at tolerance 0 VND
```

- Stable migration idempotency includes snapshot checksum, source collection/ID, detail ID, template/action/period and rule version.
- Sort effects deterministically by canonical occurred time, source creation time and source `_id`; ledger account locks use target internal ID ascending.
- Every emitted transaction stores source collection/IDs, raw/canonical time, rule/version, calculation inputs and source checksum in its business snapshot.
- Missing/duplicate/wrong detail, orphan financial reference, unsafe money, unauthorized space, unsupported interest or non-full debt settlement is `BLOCKING`.
- Difference between reconstructed and stored balance other than 0 VND is `BLOCKING`. `MIGRATION_EQUITY` requires an explicit discrepancy, approver/reason/evidence and anchor transaction under DEC-044.

## 2. Source-to-template routing

| Source evidence | Approved template | Transform/posting rule | Reject/reconciliation |
|---|---|---|---|
| `accounts.initBalance` at account creation | `OPENING_BALANCE` | Signed B posts account/equity; B=0 creates resource without ledger rows. Normal account may open negative. | Compare opening+all effects to stored balance; unexplained difference blocks. |
| `accumulations` creation | `ACCUMULATION_OPENING` | Create active zero-balance goal, no ledger rows. | Nonzero source opening/history inconsistency blocks. |
| `transactions(type=income)` + one `incomes` detail | `INCOME` | Resolve target typed ref; target +A, income clearing -A. | A>0; wrong/missing/duplicate detail or target blocks. |
| `transactions(type=expense)` + one `expenses` detail | `EXPENSE` | Resolve source; source -A, expense clearing +A. | A>0; source after reconstruction >=0; orphan blocks. |
| `transactions(type=transfer)` + one `transfers` detail not owned by saving/goal lifecycle | `TRANSFER` | Same-space source -A/target +A; preserve fee in snapshot only. | A>0; source != target; cross-space or fee residual inference blocks. |
| `transactions(type=contribution)` + one `contributions` detail | `CONTRIBUTION` composite | Resolve personal owner/family membership; create atomic interspace group with contribution-out/in transactions and clearing entries. | A>0; actor ownership/membership/account spaces required; both subtransactions reconcile. |
| `transactions(type=loan)` + one `loans` detail | `LOAN_DISBURSEMENT` | Source cash -A, space loan receivable +A; rate value preserved with `UNSPECIFIED`. | A>0; contact/source required; no interest computed. |
| `transactions(type=borrowing)` + one `borrowings` detail | `BORROWING` | Target cash +A, space borrowing liability -A; rate metadata preserved. | A>0; contact/target required; no interest computed. |
| `transactions(type=repayment)` + `repayments` + original borrowing | `REPAYMENT` | Full remaining principal only: cash -P, liability +P, interest 0. | Amount != outstanding principal, duplicate settlement or ambiguous linkage blocks. |
| `transactions(type=collect)` + `collections` + original loan | `COLLECTION` | Full remaining principal only: cash +P, receivable -P, interest 0. | Same full-only blocking rules. |
| Accumulation finish transfer + final state | `ACCUMULATION_CLOSE` | P>0 goal -P/target +P; P=0 lifecycle-only; close atomically in target. | Split transfer/status or forced-zero mismatch blocks. |
| Saving opening transfer/header/detail | `SAVING_DEPOSIT` | Source -P, saving +P; link funding terms. | Family dispatcher defect does not get emulated; unsupported/missing evidence blocks. |
| Monthly saving solver evidence | `SAVING_INTEREST_MONTHLY` | Recalculate I from principal/rate/period/version; recognize then pay target. | Required source saving/period/rate and exact balance delta; otherwise DEC-069 blocks. |
| Maturity saving solver evidence | `SAVING_INTEREST_MATURITY` | Recalculate I once; recognize and pay/retain according to maturity action. | Same deterministic evidence requirement. |
| Manual/job saving close evidence | `SAVING_CLOSE` | Explicit I recognition if >0, transfer P+I, close zero. | Implicit residual does not prove I; unexplained delta blocks. |
| Parent/child saving + principal rollover transfer | `SAVING_ROLLOVER_PRINCIPAL` | Old -P/new +P; unique child/period/action. | Parent cycle, duplicate child or amount mismatch blocks. |
| Parent/child saving + evidenced interest rollover | `SAVING_ROLLOVER_PRINCIPAL_INTEREST` | Recognize I; old -(P+I), new +(P+I). | Interest must be deterministically evidenced; no residual inference. |

Exactly 17/17 business template routes are present. Full reversal is a core correction protocol, not a V1 source flow: it creates exact opposite entries and original can be reversed once.

## 3. Physical template registry

Most business templates map one-to-one to a `posting_template_definitions.code`. `CONTRIBUTION` maps to two immutable physical definitions, `CONTRIBUTION_OUT` and `CONTRIBUTION_IN`, under one atomic `interspace_transfer_groups` command. Therefore system seed creates 18 physical definitions for 17 approved business templates.

| Definition code | Required entry roles |
|---|---|
| `OPENING_BALANCE` | `ACCOUNT`, `OPENING_EQUITY` or approved `MIGRATION_EQUITY`; no roles when B=0 |
| `ACCUMULATION_OPENING` | none |
| `INCOME` | `TARGET` positive; `INCOME_CLEARING` negative |
| `EXPENSE` | `SOURCE` negative; `EXPENSE_CLEARING` positive |
| `TRANSFER` | `SOURCE` negative; `TARGET` positive |
| `CONTRIBUTION_OUT` | `SOURCE` negative; `INTERSPACE_CLEARING_OUT` positive |
| `CONTRIBUTION_IN` | `INTERSPACE_CLEARING_IN` negative; `TARGET` positive |
| `LOAN_DISBURSEMENT` | `CASH_SOURCE` negative; `LOAN_RECEIVABLE` positive |
| `BORROWING` | `CASH_TARGET` positive; `BORROWING_LIABILITY` negative |
| `REPAYMENT` | `CASH_SOURCE` negative; `BORROWING_LIABILITY` positive |
| `COLLECTION` | `CASH_TARGET` positive; `LOAN_RECEIVABLE` negative |
| `ACCUMULATION_CLOSE` | `ACCUMULATION_SOURCE` negative; `TARGET` positive; none when P=0 |
| `SAVING_DEPOSIT` | `SOURCE` negative; `SAVING_TARGET` positive |
| `SAVING_INTEREST_MONTHLY` | `INTEREST_EXPENSE` negative; `SAVING_INTEREST_CREDIT` positive; `SAVING_PAYOUT` negative; `INTEREST_TARGET` positive |
| `SAVING_INTEREST_MATURITY` | recognition pair plus optional payout pair dictated by action |
| `SAVING_CLOSE` | optional recognition pair; `SAVING_SOURCE` negative; `TARGET` positive |
| `SAVING_ROLLOVER_PRINCIPAL` | `OLD_SAVING` negative; `NEW_SAVING` positive |
| `SAVING_ROLLOVER_PRINCIPAL_INTEREST` | interest recognition pair; `OLD_SAVING` negative; `NEW_SAVING` positive |

All definition/role rows are immutable after seed. Optional/no-posting occurrence constraints are explicit in seed metadata and the database posting boundary.

## 4. Required verification derived from each rule

Every template must later have success, authorization/IDOR, invalid/zero/unsafe amount, insufficient balance, same-key same/different-hash, rollback at each write, cached-balance chain, outbox rollback and full-reversal tests. Multi-account/group templates require concurrency/deadlock-order tests. Saving templates additionally require UTC period, leap/boundary, HALF_UP, duplicate dispatch, catch-up and crash-after-commit tests. Migration dry-run verifies source/target counts, postings sum zero, entry chains, system-account totals and exact stored/reconstructed balances.
