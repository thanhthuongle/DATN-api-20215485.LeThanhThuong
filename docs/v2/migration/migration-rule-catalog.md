# Wave 0 Draft Migration Rule Catalog

Ngày lập: 2026-08-01. Catalog này là kết quả discovery, **không phải schema V2 đã duyệt**. Mọi rule mang trạng thái `DRAFT`; production counts/examples nằm trong `data-quality-report.md`.

## 1. Quy ước chung

| Rule | Draft rule | Reject/discrepancy |
|---|---|---|
| `GEN-ID` | Giữ `_id` gốc làm `legacy_mongo_id`; chỉ resolve relation sau khi parent được load. Không dùng ObjectId làm public ID V2. | Invalid/duplicate `_id` hoặc relation không resolve -> `BLOCKING` nếu ảnh hưởng ownership/financial; ngược lại archive/review theo owner. |
| `GEN-TYPE` | Profile BSON type trước transform. String 24-hex chỉ đổi thành relation khi target tồn tại; không ép kiểu mù. | `INVALID_BSON_TYPE`, `UNRESOLVED_REFERENCE`. |
| `GEN-MONEY` | Giá trị tiền phải là finite safe integer theo V1 source và map sang VND integer; tolerance đối soát là 0 VND. | fraction, NaN/infinity, unsafe integer -> `BLOCKING_FINANCIAL_VALUE`. |
| `GEN-TIME` | Parse giá trị Date/ms hợp lệ thành UTC instant; giữ raw value/provenance trong staging. Không cộng/trừ 7 giờ trong migration. | invalid/ambiguous time -> discrepancy; financial time là blocking. |
| `GEN-SOFT-DELETE` | Giữ `_destroy` và dữ liệu lịch sử; active/archive rule quyết định theo từng entity, không xóa record tài chính. | missing flag không tự suy ra deleted. |
| `GEN-DUP` | Exact duplicate, business-key duplicate và conflicting duplicate được báo riêng; chỉ merge khi có rule được duyệt. | conflict -> review, không last-write-wins. |
| `GEN-ASSET` | Giữ URL, source collection/field/index và provenance; lifecycle V2 chỉ được tạo khi URL hợp lệ. Không xóa provider object trong migration discovery. | malformed/duplicate/orphan URL -> asset discrepancy. |

## 2. Rule catalog theo collection

| ID | Source | Rule chuyển đổi draft | Dependency / reconciliation | Evidence | Status |
|---|---|---|---|---|---|
| MIG-001 | `users` | Map identity/profile/settings; normalize email chỉ để so duplicate, không merge; password/token giữ ngoài business export policy đã duyệt. | root; count, duplicate email, active-state distribution | `src/models/userModel.js`; `mongodb-inventory.md` | DRAFT |
| MIG-002 | `families` | Load owner; tách manager/member arrays thành membership rows, dedupe trong từng role nhưng báo overlap/orphan. | users; owner/manager/member relation counts | `src/models/familyModel.js` | DRAFT |
| MIG-003 | `banks` | Map code/name/logo; duplicate code không auto-merge; logo qua `GEN-ASSET`. | root; code uniqueness, account/saving references | `src/models/bankModel.js` | DRAFT |
| MIG-004 | `categories` | Map owner polymorphic; normalize parent/child edges, kiểm tra symmetry/self-edge/cycle; embedded copies không ghi đè canonical category. | users/families, then graph pass; edge counts | `src/models/categoryModel.js` | DRAFT |
| MIG-005 | `money_sources` | Map owner; xem child `moneySourceId` là bằng chứng chính, reverse arrays là đối soát; conflict tạo discrepancy. | owners then accounts/savings/accumulations; bidirectional relation totals | `src/models/moneySourceModel.js`; MDB-003 | DRAFT |
| MIG-006 | `accounts` | Canonicalize enum `orther` theo explicit map; giữ `initBalance` và `balance`; reverse transaction array chỉ dùng kiểm tra. | owner/money source/bank; reconstruct balance == stored balance | `src/models/accountModel.js`; `src/utils/constants.js`; DEC-044 | DRAFT |
| MIG-007 | `accumulations` | Map goal dates/status/balances; transaction array không là ledger authority; closed goal và non-zero balance phải báo. | owner/money source; financial reconstruction | `src/models/accumulationModel.js`; `src/services/accumulationService.js` | DRAFT |
| MIG-008 | `savings_accounts` | Map terms/rates with decimal provenance, source/target polymorphism, parent rollover; direct interest credit không tự tạo posting nếu chưa duyệt OPEN-010. | owner/bank/money source/parent; balance and rollover uniqueness | `src/models/savingsAccountModel.js`; `src/services/savingService.js` | DRAFT/OPEN-010 |
| MIG-009 | `transactions` | Load immutable header, classify 8 types; amount/time/owner/category must validate; orphan/missing detail is discrepancy. | owners/users/categories then details; one compatible detail per header | `src/models/transactionModel.js`; `src/utils/constants.js` | DRAFT |
| MIG-010 | `expenses` | Resolve header and polymorphic source; images via `GEN-ASSET`; emit posting only through approved `EXPENSE` rule. | transactions/money sources; detail uniqueness and amount totals | `src/models/expenseModel.js`; `financial-flows.md` | DRAFT |
| MIG-011 | `incomes` | Resolve header and polymorphic target; asset rules; posting waits for approved `INCOME` template. | same; detail uniqueness and totals | `src/models/incomeModel.js`; `financial-flows.md` | DRAFT |
| MIG-012 | `transfers` | Resolve header/source/target; preserve fee as raw snapshot; do not alter balances for fee until OPEN-006 closes. | transactions/money sources; source-target and fee distribution | `src/models/transferModel.js`; `src/services/transferService.js` | DRAFT/OPEN-006 |
| MIG-013 | `contributions` | Resolve family recipient/request and polymorphic sources; cross-space records classified pending OPEN-011. | transaction/family/request/money source; ownership checks | `src/models/contributionModel.js`; `src/services/contributionService.js` | DRAFT/OPEN-011 |
| MIG-014 | `loans` | Resolve header/source/contact; preserve rate plus `UNSPECIFIED` basis unless evidence proves basis. | transactions/contacts/source; debt principal totals | `src/models/loanModel.js`; DEC-021 | DRAFT |
| MIG-015 | `borrowings` | Resolve header/target/contact; same rate policy. | transactions/contacts/target; liability totals | `src/models/borrowingModel.js`; DEC-021 | DRAFT |
| MIG-016 | `collections` | Resolve loan/header/borrower/target; mixed borrower BSON handled by `GEN-TYPE`; settlement semantics waits OPEN-007. | loans/transactions/contacts; max one/full-vs-partial checks | `src/models/collectionModel.js`; `src/services/collectionSevice.js` | DRAFT/OPEN-007 |
| MIG-017 | `repayments` | Resolve borrowing/header/lender/source; mixed lender BSON handled by `GEN-TYPE`; settlement waits OPEN-007. | borrowings/transactions/contacts; settlement checks | `src/models/repaymentModel.js`; `src/services/repaymentService.js` | DRAFT/OPEN-007 |
| MIG-018 | `contacts` | Map per owner space; same-name contacts are not automatically duplicates without owner/type evidence. | users/families; orphan owner and scoped duplicate distribution | `src/models/contactModel.js` | DRAFT |
| MIG-019 | `budgets` | Split embedded `categories[]` into allocation rows plus child transaction links; retain raw embedded snapshot/order; validate copied graph refs. | owners/categories/transactions; amount/spend aggregates | `src/models/budgetModel.js` and budget aggregation call sites | DRAFT |
| MIG-020 | `notifications` | Map immutable notification content/link; classify source side effect where possible. | root; count and link/type distributions | `src/models/notificatioModel.js` | DRAFT |
| MIG-021 | `user_notifications` | Resolve both parents; preserve read/receive timestamps; composite duplicate is reported, not collapsed silently. | users/notifications; orphan/composite duplicate counts | `src/models/userNotificationModel.js` | DRAFT |
| MIG-022 | `contribution_requests` | Archive or map only after live-count/frontend evidence; normalize contributor array if retained. | owner/family/users/target; current source status schema-only | `src/models/contributionRequestModel.js`; MDB-001 | DRAFT/BLOCKED |
| MIG-023 | `group_payouts` | Archive or map after live evidence; if retained, require transaction/source/target/recipient resolution. | transaction/users/money sources; schema-only count | `src/models/groupPayoutModel.js`; MDB-001 | DRAFT/BLOCKED |
| MIG-024 | `invitations` | Archive or map after live evidence; only declared status/relations are trusted, not broken time validator. | users/families; status/orphan counts | `src/models/invitationModel.js`; MDB-008 | DRAFT/BLOCKED |
| MIG-025 | `proposal_expenses` | Preserve proposal/status/review/assets; no financial posting unless linked transaction evidence exists. | owner/target/reviewer/category/transaction; schema-only count | `src/models/proposalExpenseModel.js`; MDB-001 | DRAFT/BLOCKED |
| MIG-026 | `system_tasks` | Do not conflate with Agenda internal collection; archive or migrate only versioned, recognized payloads after live inventory. | job inventory; collection/index/payload counts | `src/models/systemTaskModel.js`; `background-jobs.md` | DRAFT/BLOCKED |

## 3. Load order draft

```text
raw immutable staging
-> users, banks, notifications
-> families, contacts, categories
-> money_sources
-> accounts, accumulations, savings_accounts
-> transactions
-> transaction detail/debt collections
-> budgets, user_notifications, optional family/schema-only collections
-> relation/ledger reconstruction and reconciliation
```

Self/cyclic relations (`categories`, saving rollover) are loaded in two passes. Polymorphic references require both companion type and target existence. Any financial orphan, ambiguous money value, unapproved implicit-interest reconstruction or stored/reconstructed balance mismatch is `BLOCKING`; no synthetic adjustment is created outside DEC-044.

## 4. Review record

- Coverage: 26/26 source-declared collections have a draft rule and owner/evidence path.
- Required classes covered: embedded documents, arrays, ObjectId/mixed BSON, orphan, duplicate, invalid/null, money, time, soft delete, file URL and financial history.
- Actual production counts/examples are profiled for all 20 data-quality classes; 11 source-declared collections are absent/empty and retain their draft rules for future/final snapshots.
- Approval gate: rules stay `DRAFT` until data profile, open decisions and Phase 3 target schema are reviewed.
