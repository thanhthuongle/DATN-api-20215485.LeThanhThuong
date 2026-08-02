# Wave 0 Draft Migration Rule Catalog

Ngày lập: 2026-08-01; Phase 3 approval: 2026-08-02. Catalog này **không thay thế schema vật lý V2**. W2-02 review 305/305 source field dispositions và dependency graph; W2-04 áp dụng DEC-065..070 và approved posting matrix. Các rule dưới đây là migration dispositions đã duyệt cho Wave 2.

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
| MIG-001 | `users` | Map identity/profile/settings; normalize identity keys; migrate supported password hash; drop raw verification token and force V2 login/session. | root; count, duplicate email, active-state distribution | `src/models/userModel.js`; `mongodb-inventory.md` | APPROVED |
| MIG-002 | `families` | Load owner; split manager/member arrays into membership rows, dedupe within role and report overlap/orphan. | users; owner/manager/member relation counts | `src/models/familyModel.js`; DEC-068 | APPROVED |
| MIG-003 | `banks` | Map code/name/logo; duplicate code does not auto-merge; retain external logo URL provenance. | root; code uniqueness, account/saving references | `src/models/bankModel.js` | APPROVED |
| MIG-004 | `categories` | Resolve space; normalize graph edges; validate symmetry/self-edge/cycle; embedded copies do not overwrite canonical category. | spaces then graph pass; edge counts | `src/models/categoryModel.js` | APPROVED |
| MIG-005 | `money_sources` | Archive envelope; child owner/reference is canonical and reverse arrays are reconciliation evidence. | spaces then holders; bidirectional relation totals | `src/models/moneySourceModel.js`; MDB-003 | APPROVED_ARCHIVE |
| MIG-006 | `accounts` | Canonicalize `orther`; preserve init/stored balances; reconstruct approved opening/history at tolerance 0; reverse array is evidence. | space/bank/ledger reconstruction | source; DEC-044/067 | APPROVED |
| MIG-007 | `accumulations` | Map goal/time/status; reconstruct approved flows; transaction array is non-authoritative; zero close emits no entry. | space/ledger reconstruction | source; DEC-067 | APPROVED |
| MIG-008 | `savings_accounts` | Map terms/rates/targets/rollover; only reconstruct direct interest with deterministic evidence, otherwise blocking. | space/bank/targets/parent/ledger | source; DEC-069 | APPROVED |
| MIG-009 | `transactions` | Load immutable header; validate positive money movement/opening exceptions; require one compatible detail. | spaces/users/categories then details | source; DEC-067 | APPROVED |
| MIG-010 | `expenses` | Resolve header/source/assets and emit only approved `EXPENSE` postings. | transaction/ledger/asset | source; approved matrix | APPROVED |
| MIG-011 | `incomes` | Resolve header/target/assets and emit only approved `INCOME` postings. | transaction/ledger/asset | source; approved matrix | APPROVED |
| MIG-012 | `transfers` | Resolve same-space source/target; preserve fee metadata with no ledger effect. | transaction/ledger; fee distribution | source; DEC-065/070 | APPROVED |
| MIG-013 | `contributions` | Resolve personal source/family target/membership and map to atomic two-transaction interspace group. | users/spaces/membership/ledger | source; DEC-070 | APPROVED |
| MIG-014 | `loans` | Resolve origin/source/contact; preserve rate with `UNSPECIFIED` basis unless evidenced; no automatic interest. | transaction/contact/ledger | source; DEC-021/066 | APPROVED |
| MIG-015 | `borrowings` | Resolve origin/target/contact with the same rate/no-auto-interest policy. | transaction/contact/ledger | source; DEC-021/066 | APPROVED |
| MIG-016 | `collections` | Resolve receivable settlement; require full outstanding principal, interest 0; mixed BSON via validated relation. | debt/transaction/contact/ledger | source; DEC-066 | APPROVED |
| MIG-017 | `repayments` | Resolve payable settlement; require full outstanding principal, interest 0; mixed BSON via validated relation. | debt/transaction/contact/ledger | source; DEC-066 | APPROVED |
| MIG-018 | `contacts` | Map per space; same-name contacts are not globally merged. | spaces; scoped duplicate distribution | `src/models/contactModel.js` | APPROVED |
| MIG-019 | `budgets` | Split embedded allocations; retain snapshot/order; copied graph/transaction arrays are evidence only. | spaces/categories/transactions | source aggregation call sites | APPROVED |
| MIG-020 | `notifications` | Map immutable notification content/link and source side-effect provenance. | root/space/outbox optional | `src/models/notificatioModel.js` | APPROVED |
| MIG-021 | `user_notifications` | Resolve both parents; preserve read/receive time; composite duplicate becomes discrepancy. | users/notifications | `src/models/userNotificationModel.js` | APPROVED |
| MIG-022 | `contribution_requests` | Archive every discovered row; do not enable unreviewed request behavior. | schema-only archive lane | source; field mapping | APPROVED_ARCHIVE |
| MIG-023 | `group_payouts` | Archive every discovered row; never emit financial posting. | schema-only archive lane | source; field mapping | APPROVED_ARCHIVE |
| MIG-024 | `invitations` | Archive every discovered row; ignore broken unrelated time validator. | schema-only archive lane | source; MDB-008 | APPROVED_ARCHIVE |
| MIG-025 | `proposal_expenses` | Archive proposal/review/assets; never emit posting. | schema-only archive lane | source; field mapping | APPROVED_ARCHIVE |
| MIG-026 | `system_tasks` | Archive application-schema rows; never conflate/copy Agenda internal payload/locks. | schema-only archive lane | source; background jobs | APPROVED_ARCHIVE |

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
- W2-02 field gate: PASS — 26/26 collections, 305/305 field paths, mỗi path có đúng một quyết định migrate/transform/archive/drop; load graph định tuyến đủ 26/26 collections.
- Phase 3 approval gate: PASS — 26/26 collection rules approved, including five explicit archive-only dispositions; DEC-065..070 and 17/17 approved posting templates are applied.
