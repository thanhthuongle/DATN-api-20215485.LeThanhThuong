# MongoDB V1 Collection and Relation Inventory

Ngày inventory: 2026-08-01. Đây là inventory schema **được source khai báo**; counts/type profiling từ database thật được theo dõi riêng trong `data-quality-report.md`.

## 1. Coverage

- Đã đọc toàn bộ 26 file dưới `src/models/`, `src/utils/constants.js`, tất cả model call sites và aggregation pipelines.
- Source khai báo **26 business/application collections**. Có 21 collections có CRUD/query implementation và 5 collections chỉ có schema, không có create/query call path (`contribution_requests`, `group_payouts`, `invitations`, `proposal_expenses`, `system_tasks`).
- Có **13 aggregate call sites** thuộc 9 logical query families. Không tìm thấy `createIndex`/index bootstrap nào trong `src/`; `_id` là index duy nhất có thể khẳng định từ MongoDB mặc định. Index thực tế cần lấy từ database.
- Mọi model dùng Joi trước create, nhưng MongoDB không có JSON Schema validator trong source; legacy/manual writes có thể nằm ngoài Joi contract.

Quy ước type: `OID` ObjectId, `N` JavaScript number, `D` Date/ISO-date được driver lưu, `ms` timestamp millisecond number. Các trường audit phổ biến là `createdAt:D/ms`, `updatedAt:D/ms|null`, `_destroy:boolean`; riêng `user_notifications` không có bộ ba này.

## 2. Collection inventory

| Collection / owner | Fields theo source schema | Embedded/arrays | Relations và polymorphism | Source status |
|---|---|---|---|---|
| `users` / identity | email, password, username, displayName, avatar, isActive, verifyToken, language, currency, remindToInput, remindTime, startDayOfWeek, startDayOfMonth, audit | none | `_id` được nhiều collection tham chiếu | ACTIVE CRUD |
| `families` / families | familyName, backgroundImage, ownerId, managerIds, memberIds, audit | `managerIds[]`, `memberIds[]` | owner/manager/member -> users | ACTIVE CRUD |
| `banks` / banks | code, name, logo, audit | none | <- accounts/savings.bankId | ACTIVE seed/read |
| `categories` / categories | ownerType, ownerId, name, type, allowDelete, icon, childrenIds, parentIds, audit | graph arrays | ownerId -> user/family by ownerType; children/parents -> categories | ACTIVE read/seed |
| `money_sources` / money-sources | ownerType, ownerId, accountIds, savings_accountIds, accumulationIds, audit | three OID arrays | owner polymorphic; arrays -> three source collections | ACTIVE CRUD/read model |
| `accounts` / accounts | ownerType, ownerId, moneySourceId, type, accountName, initBalance, balance, bankId, description, icon, isBlock, transactionIds, audit | `transactionIds[]` | owner polymorphic; -> money_sources/banks/transactions | ACTIVE financial |
| `accumulations` / accumulations | ownerType, ownerId, moneySourceId, accumulationName, balance, targetBalance, startDate, endDate, isFinish, transactionIds, description, audit | `transactionIds[]` | owner polymorphic; -> money_sources/transactions | ACTIVE financial |
| `savings_accounts` / savings | ownerType, ownerId, moneySourceId, savingsAccountName, bankId, initBalance, balance, rate, nonTermRate, startDate, term, interestPaid, termEnded, interestPaidTargetId/Type, description, isClosed, isRolledOver, parentSavingId, transactionIds, moneyFromId/Type, audit | `transactionIds[]` | owner polymorphic; -> bank/money-source; target/source polymorphic; parent self-FK | ACTIVE financial |
| `transactions` / transactions | ownerType, ownerId, responsiblePersonId, proposalId, type, categoryId, name, description, amount, transactionTime, audit | none | owner polymorphic; responsible -> user; proposal -> proposal_expenses; category -> categories | ACTIVE transaction header |
| `expenses` / transactions | transactionId, moneyFromType/Id, images, audit | URL `images[]` | header -> transactions; source polymorphic account/saving/accumulation | ACTIVE detail |
| `incomes` / transactions | transactionId, moneyTargetType/Id, images, audit | URL `images[]` | header -> transactions; target polymorphic | ACTIVE detail |
| `transfers` / transactions | transactionId, moneyFromType/Id, moneyTargetType/Id, fee, images, audit | URL `images[]` | header + two polymorphic money sources | ACTIVE detail |
| `contributions` / transactions | transactionId, recipientId, moneyFromType/Id, moneyTargetType/Id, contributionRequestId, images, audit | URL `images[]` | header; recipient -> family; sources polymorphic; optional request | ACTIVE detail |
| `loans` / debt | transactionId, moneyFromType/Id, borrowerId, rate, collectTime, trustLevel, images, audit | URL `images[]` | header; source polymorphic; borrower -> contacts | ACTIVE detail/update |
| `borrowings` / debt | transactionId, moneyTargetType/Id, lenderId, rate, repaymentTime, images, audit | URL `images[]` | header; target polymorphic; lender -> contacts | ACTIVE detail |
| `collections` / debt | transactionId, loanTransactionId, borrowerId, moneyTargetType/Id, realCollectTime, images, audit | URL `images[]` | header/loan header; borrower -> contacts; target polymorphic | ACTIVE detail |
| `repayments` / debt | transactionId, borrowingTransactionId, lenderId, moneyFromType/Id, realRepaymentTime, images, audit | URL `images[]` | header/borrowing header; lender -> contacts; source polymorphic | ACTIVE detail |
| `contacts` / contacts | ownerType, ownerId, name, trustLevel, audit | none | owner polymorphic user/family | ACTIVE CRUD |
| `budgets` / budgets | ownerType, ownerId, startTime, endTime, categories, audit | **embedded `categories[]`**: categoryId/name/icon, childrenIds[], parentIds[], amount, repeat, transactionIds[] | owner polymorphic; embedded refs -> categories/transactions | ACTIVE CRUD/aggregation |
| `notifications` / notifications | title, message, type, link, audit | none | <- user_notifications.notificationId | ACTIVE create/read |
| `user_notifications` / notifications | userId, notificationId, isRead, readAt, receiveAt | none | -> users/notifications | ACTIVE create/read/update |
| `contribution_requests` / family finance | ownerType/Id, familyId, name, description, amount, moneyTargetType/Id, deadline, contributerIds, audit | `contributerIds[]` | owner/family/users; polymorphic target | SCHEMA_ONLY; only findById |
| `group_payouts` / family finance | transactionId, recipientId, moneyFromType/Id, moneyTargetType/Id, images, audit | URL `images[]` | header; recipient -> user; sources polymorphic | SCHEMA_ONLY; no persistence function |
| `invitations` / families | inviterId, inviteeId, familyId, status, audit | none | users/family | SCHEMA_ONLY; no persistence function |
| `proposal_expenses` / family finance | ownerType/Id, targetId, name, amount, categoryId, description, status, images, reviewerId, reviewed_at, audit | URL `images[]` | owner/target/reviewer/category | SCHEMA_ONLY; no persistence function |
| `system_tasks` / jobs | type, data, scheduleTime, repeat, status, audit | opaque embedded `data` object | intended job payload; no model persistence path | SCHEMA_ONLY; Agenda uses its own configured collection |

## 3. Embedded documents and array-reference inventory

| Source path | Semantics | Migration concern / rule owner |
|---|---|---|
| `budgets.categories[]` | snapshot-like budget allocation plus category graph and transaction IDs | Budget owner: split allocation child rows; preserve source order only if frontend evidence requires it; deduplicate refs; do not trust embedded names as current category truth without explicit snapshot rule. |
| `system_tasks.data` | arbitrary job payload | Jobs owner: archive if unused; if live, version/schema each job payload. |
| `families.managerIds[]`, `memberIds[]` | membership roles | Identity/family owner: join table; detect duplicates, overlap and orphan users. |
| `money_sources.accountIds[]`, `savings_accountIds[]`, `accumulationIds[]` | reverse ownership lists | Accounts owner: derive/validate against child `moneySourceId`; conflicting direction is discrepancy. |
| `accounts/accumulations/savings.transactionIds[]` | denormalized transaction linkage | Transaction owner: migrate relation from canonical transaction detail/header evidence; array order not authoritative; duplicate/orphan refs counted. |
| `categories.childrenIds[]`, `parentIds[]` | bidirectional category graph | Category owner: normalize relation; verify symmetry, self-edge/cycle, duplicates/orphans. |
| `budgets.categories.*Ids[]` | copied graph and linked spend transactions | Budget owner: child/join rows; validate against primary categories/transactions. |
| `contribution_requests.contributerIds[]` | expected contributor users | Family finance owner: join table; spelling preserved as legacy field mapping. |
| `*.images[]` | Cloudinary URL strings | Asset owner: convert to attachments/assets only after URL/profile inventory; preserve source URL/provenance. |

## 4. ObjectId relation inventory and type hazards

MongoDB does not enforce these as foreign keys. `ownerId` and money-source IDs are polymorphic and must resolve using their companion type.

| Finding | Evidence | Data-quality query required |
|---|---|---|
| `collections.borrowerId` passes Joi string but `createNew` does not convert it to ObjectId. | `collectionModel.js:35-44` converts transactionId, moneyTargetId, loanTransactionId only. | Count BSON types for borrowerId; resolve both string/OID forms; never coerce silently. |
| `repayments.lenderId` likewise is not converted in `createNew`. | `repaymentModel.js:35-44`. | Count BSON types and orphan contacts. |
| Optional `accounts.ownerId` and `savings_accounts.ownerId` are converted unconditionally with `new ObjectId(validData.ownerId)`. | schemas lines 10-12; create methods. | Count missing/null records and rejected/legacy shapes. |
| `categoryModel.insertMany` writes data directly without calling its declared validator or ObjectId conversion. | `categoryModel.js:42-47`; called by category clone paths. | Profile ownerId/childrenIds/parentIds BSON types. |
| Model update methods accept broad update objects after removing a short denylist; they do not re-run Joi. | contact/family/loan/savings/user models. | Profile all fields against schema; invalid legacy values remain possible. |
| No source-declared unique/index constraints for email, bank code, transactionId detail links, ownership keys or array relations. | zero `createIndex` hits under `src/`. | List actual DB indexes; count exact/business-key duplicates before mapping. |

## 5. Aggregation/query inventory

There are 13 `.aggregate()` call sites:

| Query family | Call sites | Pipeline/dependency | Migration/index owner |
|---|---:|---|---|
| Account list + bank | 1 | match account, lookup bank, unwind optional, sort createdAt | accounts |
| Borrowing detail + lender | 1 | match, lookup contacts, optional unwind | debt |
| Loan detail + borrower | 1 | match, lookup contacts, optional unwind | debt |
| Budget spent (individual/family) | 2 | match, unwind embedded categories, lookup transactionIds, sum amount, group | budgets/reporting |
| Collection by loan | 1 | match, lookup transaction header, merge header/detail | debt |
| Repayment by borrowing | 1 | match, lookup transaction header, merge header/detail | debt |
| Money-source composite individual/family | 2 | lookup accounts/savings/accumulations; individual also nested bank lookups/sorts | money-sources |
| Transaction category enrichment/list/detail/recent | 3 | match, lookup category, optional unwind; recent sort+limit 20 | transactions/reporting |
| User notification enrichment | 1 | match user, lookup notification, required unwind, sort | notifications |

All aggregation semantics must be reproduced by V2 query/read-model design or recorded as an approved contract difference. Missing joined records are intentionally preserved only where `preserveNullAndEmptyArrays: true`; notification lookup drops orphan links due to required unwind.

## 6. Inventory findings and ownership

| ID | Finding | Owner | Status/rule |
|---|---|---|---|
| MDB-001 | 26 source-declared collections, including 5 schema-only/dormant collections. Actual database may also contain Agenda/internal collections. | Migration/jobs | OPEN until live `listCollections`/counts. |
| MDB-002 | No application-managed index definitions found. | Database design | OPEN; capture live index manifests in W0-09, design in Phase 3. |
| MDB-003 | Reverse arrays and child foreign fields can disagree (`money_sources` vs children; transactionIds vs detail records). | Accounts/transactions | BLOCKING class if financial relation changes reconstructed balance; count in W0-09. |
| MDB-004 | Mixed BSON type is plausible for collection borrower and repayment lender due to missing conversion. | Debt migration | Transform only with valid 24-hex + existing contact; otherwise discrepancy. |
| MDB-005 | All monetary values/rates are Joi/JavaScript numbers in V1. | Financial migration | Profile non-integer/unsafe/rate precision; V2 BIGINT/DECIMAL mapping per DEC-012/021/030. |
| MDB-006 | Soft-delete convention is widespread but not universal and queries do not uniformly include `_destroy:false`. | Every module | Define per-entity active/archive rule; preserve historical financial records. |
| MDB-007 | `ACCOUNT_TYPES.OTHER` persisted enum value is misspelled `orther`. | Accounts | Preserve legacy value in extract; explicit transform to canonical V2 enum with count. |
| MDB-008 | `invitations` custom validator compares nonexistent start/end fields and therefore adds no meaningful invariant. | Families | Profile status/relations; do not infer time rule. |

## 7. Review record

- Coverage: 26/26 model schemas are represented above; 13/13 aggregate call sites reconciled.
- Relation review: every `ObjectId` conversion, schema reference array and `$lookup.from` has an owner/rule.
- Production profile: 15 live/26 source-declared collections; 11 absent/empty; 16 total indexes and 0 non-`_id` unique indexes. Counts/types/examples are recorded in `data-quality-report.md`.
- Diff review: documentation only; no V1 source/model/index/data changed.
