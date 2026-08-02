# MongoDB V1 to PostgreSQL V2 Field Mapping

Ngày review: 2026-08-02. Trạng thái: **REVIEWED cho W2-02**. Target bên dưới là logical path đã chốt ở W2-01; tên bảng/column/type/constraint vật lý chỉ được chốt tại W2-03.

## 1. Quy ước

| Action | Ý nghĩa |
|---|---|
| `MIGRATE` | Giữ nguyên ý nghĩa nghiệp vụ, chỉ encode sang target type chuẩn. |
| `TRANSFORM` | Chuẩn hóa enum/type/time, resolve FK, tách array/embedded document hoặc tạo provenance rõ ràng. |
| `ARCHIVE` | Không trở thành state nghiệp vụ authoritative; giữ raw path/value trong immutable migration archive/evidence. |
| `DROP` | Không mang sang target hoặc archive vì là secret/token không an toàn hay dữ liệu dẫn xuất vô nghĩa; lý do bắt buộc ghi rõ. |

Quy tắc dùng cho mọi collection:

- `_id` hợp lệ được `TRANSFORM` thành nullable unique `legacy_mongo_id`; internal identity và public UUID do PostgreSQL tạo, không derive từ ObjectId.
- `createdAt`/`updatedAt` được `TRANSFORM` từ BSON Date hoặc epoch millisecond thành UTC; raw type/value hash được giữ trong migration provenance.
- `_destroy` được `TRANSFORM` thành lifecycle/soft-delete state. Financial/audit history không hard-delete.
- `ownerType + ownerId` được resolve cùng nhau thành `financial_space_id`; không giữ polymorphic owner tự do.
- Money source `{Type,Id}` được resolve thành một ledger-backed target cụ thể; invalid/missing pair tạo discrepancy, không coerce mù.
- Reverse-reference arrays chỉ là reconciliation evidence; canonical target relation được dựng từ owning child/detail record.

## 2. Field disposition catalog

### 2.1 Identity, family, bank, category and legacy money-source envelope

| Source path | Action | Logical target / rule |
|---|---|---|
| `users._id` | TRANSFORM | `User.legacy_mongo_id`; validate unique 24-hex. |
| `users.email` | TRANSFORM | `User.email`; trim/canonical comparison key, preserve original display form; duplicate blocks load. |
| `users.password` | TRANSFORM | `User.password_hash`; retain supported bcrypt hash, never expose/archive plaintext. |
| `users.username` | MIGRATE | `User.username`; scoped uniqueness decided physically. |
| `users.displayName` | MIGRATE | `User.display_name`. |
| `users.avatar` | TRANSFORM | `TemporaryAsset/Attachment` or `LEGACY_EXTERNAL_URL` with source provenance. |
| `users.isActive` | TRANSFORM | `User.status` (`ACTIVE`/`INACTIVE`); inactive user cannot authenticate. |
| `users.verifyToken` | DROP | Raw V1 verification token is not migrated; inactive account must use a new V2 verification flow. |
| `users.language` | TRANSFORM | `User.language_code`; legacy `Tiếng Việt` -> reviewed canonical locale. |
| `users.currency` | TRANSFORM | `User.currency_code`; only `VND` accepted by DEC-030. |
| `users.remindToInput` | MIGRATE | `User.reminder_enabled`. |
| `users.remindTime` | TRANSFORM | Local reminder intent + UTC schedule using validated IANA timezone; raw instant kept in provenance. |
| `users.startDayOfWeek` | TRANSFORM | `User.week_start`; canonical enum. |
| `users.startDayOfMonth` | MIGRATE | `User.month_start_day`; validate 1..31 policy physically. |
| `users.createdAt` | TRANSFORM | `User.created_at` UTC. |
| `users.updatedAt` | TRANSFORM | `User.updated_at` UTC nullable. |
| `users._destroy` | TRANSFORM | `User.deleted_at/status`; preserve inactive/deleted distinction. |
| `families._id` | TRANSFORM | `FinancialSpace.legacy_mongo_id` for family space. |
| `families.familyName` | MIGRATE | `FinancialSpace.name`. |
| `families.backgroundImage` | TRANSFORM | Space attachment or `LEGACY_EXTERNAL_URL` with provenance. |
| `families.ownerId` | TRANSFORM | Owning `FinancialSpaceMembership.user_id` with role `OWNER`. |
| `families.managerIds` | TRANSFORM | Membership rows role `MANAGER`; dedupe and report orphan/overlap. |
| `families.memberIds` | TRANSFORM | Membership rows role `MEMBER`; dedupe and report orphan/overlap. |
| `families.createdAt` | TRANSFORM | `FinancialSpace.created_at` UTC. |
| `families.updatedAt` | TRANSFORM | `FinancialSpace.updated_at` UTC nullable. |
| `families._destroy` | TRANSFORM | Space lifecycle/soft-delete; RESTRICT when history exists. |
| `banks._id` | TRANSFORM | `Bank.legacy_mongo_id`. |
| `banks.code` | TRANSFORM | Canonical uppercase `Bank.code`; duplicate code is blocking, no auto-merge. |
| `banks.name` | MIGRATE | `Bank.name`. |
| `banks.logo` | MIGRATE | `Bank.logo_url`; 21 profiled non-Cloudinary reference URLs retained. |
| `banks.createdAt` | TRANSFORM | `Bank.created_at` UTC. |
| `banks.updatedAt` | TRANSFORM | `Bank.updated_at` UTC nullable. |
| `banks._destroy` | TRANSFORM | `Bank.deleted_at/is_active`; referenced bank is not hard-deleted. |
| `categories._id` | TRANSFORM | `Category.legacy_mongo_id`. |
| `categories.ownerType` | TRANSFORM | Companion discriminator for `Category.financial_space_id`; raw value in provenance. |
| `categories.ownerId` | TRANSFORM | Resolve `Category.financial_space_id`. |
| `categories.name` | MIGRATE | `Category.name`. |
| `categories.type` | TRANSFORM | Canonical category purpose enum; validate against transaction flow. |
| `categories.allowDelete` | TRANSFORM | `Category.is_system_locked` inverse/explicit lifecycle policy. |
| `categories.icon` | MIGRATE | `Category.icon`. |
| `categories.childrenIds` | TRANSFORM | Directed `CategoryEdge(parent, child)` rows; validate symmetry/cycle/orphans. |
| `categories.parentIds` | TRANSFORM | Same canonical `CategoryEdge`; reconciliation input, not second authority. |
| `categories.createdAt` | TRANSFORM | `Category.created_at` UTC. |
| `categories.updatedAt` | TRANSFORM | `Category.updated_at` UTC nullable. |
| `categories._destroy` | TRANSFORM | `Category.deleted_at`; referenced category RESTRICT. |
| `money_sources._id` | ARCHIVE | `LegacyMoneySourceEnvelope.legacy_mongo_id`; no target balance-holder entity. |
| `money_sources.ownerType` | TRANSFORM | Resolve envelope owner to `FinancialSpace.kind`; raw archived. |
| `money_sources.ownerId` | TRANSFORM | Resolve personal/family `FinancialSpace`; raw archived. |
| `money_sources.accountIds` | ARCHIVE | Reverse relation evidence; target account ownership comes from validated child `moneySourceId` + owner. |
| `money_sources.savings_accountIds` | ARCHIVE | Reverse relation evidence; compare with saving child relation. |
| `money_sources.accumulationIds` | ARCHIVE | Reverse relation evidence; compare with accumulation child relation. |
| `money_sources.createdAt` | ARCHIVE | Envelope provenance timestamp; space timestamp comes from owner entity. |
| `money_sources.updatedAt` | ARCHIVE | Envelope provenance timestamp. |
| `money_sources._destroy` | ARCHIVE | Envelope lifecycle evidence; child/space lifecycle resolved independently. |

### 2.2 Balance holders

| Source path | Action | Logical target / rule |
|---|---|---|
| `accounts._id` | TRANSFORM | `Account.legacy_mongo_id`. |
| `accounts.ownerType` | TRANSFORM | Companion discriminator for `Account.financial_space_id`. |
| `accounts.ownerId` | TRANSFORM | Resolve `Account.financial_space_id`; missing owner is blocking. |
| `accounts.moneySourceId` | ARCHIVE | Validate against owner envelope; no target FK because envelope is removed. |
| `accounts.type` | TRANSFORM | `Account.type`; legacy `orther` -> canonical `OTHER`. |
| `accounts.accountName` | MIGRATE | `Account.name`. |
| `accounts.initBalance` | TRANSFORM | Audited opening/migration-anchor amount; not directly copied as current balance. |
| `accounts.balance` | TRANSFORM | `LedgerAccount.current_balance` only after tolerance-0 reconciliation; source stored value retained as migration evidence. |
| `accounts.bankId` | TRANSFORM | Nullable `Account.bank_id`; orphan is discrepancy. |
| `accounts.description` | MIGRATE | `Account.description`. |
| `accounts.icon` | MIGRATE | `Account.icon`. |
| `accounts.isBlock` | TRANSFORM | `Account.status`/write-block policy. |
| `accounts.transactionIds` | ARCHIVE | Reverse history evidence; canonical relation derives from transaction detail/postings. |
| `accounts.createdAt` | TRANSFORM | `Account.created_at` UTC. |
| `accounts.updatedAt` | TRANSFORM | `Account.updated_at` UTC nullable. |
| `accounts._destroy` | TRANSFORM | Account close/archive lifecycle; history RESTRICT. |
| `accumulations._id` | TRANSFORM | `AccumulationGoal.legacy_mongo_id`. |
| `accumulations.ownerType` | TRANSFORM | Companion discriminator for goal space. |
| `accumulations.ownerId` | TRANSFORM | Resolve `AccumulationGoal.financial_space_id`. |
| `accumulations.moneySourceId` | ARCHIVE | Validate legacy envelope relation; no target FK. |
| `accumulations.accumulationName` | MIGRATE | `AccumulationGoal.name`. |
| `accumulations.balance` | TRANSFORM | Paired ledger account projection after reconciliation. |
| `accumulations.targetBalance` | MIGRATE | `AccumulationGoal.target_amount` VND integer. |
| `accumulations.startDate` | TRANSFORM | `AccumulationGoal.start_at` UTC with raw provenance. |
| `accumulations.endDate` | TRANSFORM | `AccumulationGoal.end_at` UTC with raw provenance. |
| `accumulations.isFinish` | TRANSFORM | Goal lifecycle `ACTIVE`/`FINISHED`; balance/history inconsistency is discrepancy. |
| `accumulations.transactionIds` | ARCHIVE | Reverse history evidence only. |
| `accumulations.description` | MIGRATE | `AccumulationGoal.description`. |
| `accumulations.createdAt` | TRANSFORM | `AccumulationGoal.created_at` UTC. |
| `accumulations.updatedAt` | TRANSFORM | `AccumulationGoal.updated_at` UTC nullable. |
| `accumulations._destroy` | TRANSFORM | Goal archive lifecycle; history RESTRICT. |
| `savings_accounts._id` | TRANSFORM | `SavingAgreement.legacy_mongo_id`. |
| `savings_accounts.ownerType` | TRANSFORM | Companion discriminator for saving space. |
| `savings_accounts.ownerId` | TRANSFORM | Resolve `SavingAgreement.financial_space_id`. |
| `savings_accounts.moneySourceId` | ARCHIVE | Validate legacy envelope relation; no target FK. |
| `savings_accounts.savingsAccountName` | MIGRATE | `SavingAgreement.name`. |
| `savings_accounts.bankId` | TRANSFORM | `SavingAgreement.bank_id`; orphan blocks active saving load. |
| `savings_accounts.initBalance` | TRANSFORM | Principal/opening posting provenance, not copied directly to ledger balance. |
| `savings_accounts.balance` | TRANSFORM | Paired ledger projection after history/interest reconciliation. |
| `savings_accounts.rate` | TRANSFORM | `SavingAgreement.annual_rate DECIMAL`; preserve raw numeric text and validate range. |
| `savings_accounts.nonTermRate` | TRANSFORM | `SavingAgreement.non_term_annual_rate DECIMAL`; preserve raw numeric text. |
| `savings_accounts.startDate` | TRANSFORM | UTC business start with legacy local-start-of-day provenance. |
| `savings_accounts.term` | MIGRATE | `SavingAgreement.term_months`. |
| `savings_accounts.interestPaid` | TRANSFORM | Canonical interest payment schedule enum. |
| `savings_accounts.termEnded` | TRANSFORM | Canonical maturity action enum. |
| `savings_accounts.interestPaidTargetId` | TRANSFORM | Nullable resolved interest target account; pair with target type. |
| `savings_accounts.interestPaidTargetType` | TRANSFORM | Validate target kind; V1 permits account only. |
| `savings_accounts.description` | MIGRATE | `SavingAgreement.description`. |
| `savings_accounts.isClosed` | TRANSFORM | Saving lifecycle status/closed time provenance. |
| `savings_accounts.isRolledOver` | TRANSFORM | Rollover lifecycle fact; reconcile with child link. |
| `savings_accounts.parentSavingId` | TRANSFORM | Nullable self relation; detect orphan/cycle/multiple child action. |
| `savings_accounts.transactionIds` | ARCHIVE | Reverse history evidence only. |
| `savings_accounts.moneyFromType` | TRANSFORM | Funding account kind discriminator. |
| `savings_accounts.moneyFromId` | TRANSFORM | Resolve opening/funding account reference. |
| `savings_accounts.createdAt` | TRANSFORM | `SavingAgreement.created_at` UTC. |
| `savings_accounts.updatedAt` | TRANSFORM | `SavingAgreement.updated_at` UTC nullable. |
| `savings_accounts._destroy` | TRANSFORM | Saving archive lifecycle; financial history RESTRICT. |

### 2.3 Transaction header

| Source path | Action | Logical target / rule |
|---|---|---|
| `transactions._id` | TRANSFORM | `FinancialTransaction.legacy_mongo_id`. |
| `transactions.ownerType` | TRANSFORM | Companion discriminator for transaction space. |
| `transactions.ownerId` | TRANSFORM | Resolve `FinancialTransaction.financial_space_id`. |
| `transactions.responsiblePersonId` | TRANSFORM | `FinancialTransaction.responsible_user_id`; require user/member evidence. |
| `transactions.proposalId` | ARCHIVE | Optional schema-only proposal provenance; no active target FK unless final snapshot contains live records. |
| `transactions.type` | TRANSFORM | Canonical registered posting-template type; detail type must match. |
| `transactions.categoryId` | TRANSFORM | `FinancialTransaction.category_id`; same-space validation. |
| `transactions.name` | MIGRATE | `FinancialTransaction.name`. |
| `transactions.description` | MIGRATE | `FinancialTransaction.description`. |
| `transactions.amount` | TRANSFORM | VND integer command amount; zero rule remains gated by OPEN-008. |
| `transactions.transactionTime` | TRANSFORM | Immutable `occurred_at` UTC; `posted_at` is generated during target posting. |
| `transactions.createdAt` | TRANSFORM | Migration provenance and target `created_at` UTC. |
| `transactions.updatedAt` | ARCHIVE | Posted financial metadata is immutable; legacy update timestamp remains provenance only. |
| `transactions._destroy` | TRANSFORM | Active/reversed/archived migration state; never delete ledger history. |

### 2.4 Active transaction details and debts

| Source path | Action | Logical target / rule |
|---|---|---|
| `expenses._id` | TRANSFORM | Expense fact `legacy_mongo_id`. |
| `expenses.transactionId` | TRANSFORM | Unique link to compatible `FinancialTransaction`. |
| `expenses.moneyFromType` | TRANSFORM | Source ledger-backed resource kind. |
| `expenses.moneyFromId` | TRANSFORM | Resolve source account/goal/saving in the same space. |
| `expenses.images` | TRANSFORM | One asset/attachment provenance row per ordered URL. |
| `expenses.createdAt` | TRANSFORM | Detail/migration provenance UTC. |
| `expenses.updatedAt` | ARCHIVE | Posted fact immutable; legacy value retained as provenance. |
| `expenses._destroy` | TRANSFORM | Detail migration state consistent with transaction state. |
| `incomes._id` | TRANSFORM | Income fact `legacy_mongo_id`. |
| `incomes.transactionId` | TRANSFORM | Unique link to compatible `FinancialTransaction`. |
| `incomes.moneyTargetType` | TRANSFORM | Target ledger-backed resource kind. |
| `incomes.moneyTargetId` | TRANSFORM | Resolve target account/goal/saving in the same space. |
| `incomes.images` | TRANSFORM | One asset/attachment provenance row per ordered URL. |
| `incomes.createdAt` | TRANSFORM | Detail/migration provenance UTC. |
| `incomes.updatedAt` | ARCHIVE | Posted fact immutable; legacy value retained as provenance. |
| `incomes._destroy` | TRANSFORM | Detail migration state consistent with transaction state. |
| `transfers._id` | TRANSFORM | Transfer fact `legacy_mongo_id`. |
| `transfers.transactionId` | TRANSFORM | Unique link to compatible `FinancialTransaction`. |
| `transfers.moneyFromType` | TRANSFORM | Source resource discriminator. |
| `transfers.moneyFromId` | TRANSFORM | Resolve source ledger account. |
| `transfers.moneyTargetType` | TRANSFORM | Target resource discriminator. |
| `transfers.moneyTargetId` | TRANSFORM | Resolve target ledger account. |
| `transfers.fee` | TRANSFORM | Preserve VND fee metadata; postings wait for OPEN-006, never infer a balance effect. |
| `transfers.images` | TRANSFORM | Asset/attachment provenance rows. |
| `transfers.createdAt` | TRANSFORM | Detail/migration provenance UTC. |
| `transfers.updatedAt` | ARCHIVE | Posted fact immutable; legacy value retained as provenance. |
| `transfers._destroy` | TRANSFORM | Detail migration state consistent with transaction state. |
| `contributions._id` | TRANSFORM | `InterspaceTransferGroup.legacy_mongo_id`. |
| `contributions.transactionId` | TRANSFORM | Legacy header identity becomes source-side transaction provenance; target-side transaction is generated. |
| `contributions.recipientId` | TRANSFORM | Resolve target family `FinancialSpace`; require active actor membership per DEC-070. |
| `contributions.moneyFromType` | TRANSFORM | Source resource discriminator. |
| `contributions.moneyFromId` | TRANSFORM | Resolve source ledger account. |
| `contributions.moneyTargetType` | TRANSFORM | Target resource discriminator. |
| `contributions.moneyTargetId` | TRANSFORM | Resolve target family ledger account; group posts two linked space-local transactions via `INTERSPACE_CLEARING`. |
| `contributions.contributionRequestId` | ARCHIVE | Optional schema-only request provenance until a live canonical request exists. |
| `contributions.images` | TRANSFORM | Asset/attachment provenance rows. |
| `contributions.createdAt` | TRANSFORM | Detail/migration provenance UTC. |
| `contributions.updatedAt` | ARCHIVE | Posted fact immutable; legacy value retained as provenance. |
| `contributions._destroy` | TRANSFORM | Detail migration state consistent with transaction state. |
| `loans._id` | TRANSFORM | `DebtAgreement.legacy_mongo_id` for receivable. |
| `loans.transactionId` | TRANSFORM | Unique originating financial transaction link. |
| `loans.moneyFromType` | TRANSFORM | Disbursement source discriminator. |
| `loans.moneyFromId` | TRANSFORM | Resolve disbursement ledger account. |
| `loans.borrowerId` | TRANSFORM | Resolve space-scoped `Contact`; mixed BSON handling uses existence check. |
| `loans.rate` | TRANSFORM | Decimal rate value with `rate_basis=UNSPECIFIED` absent stronger evidence. |
| `loans.collectTime` | TRANSFORM | Nullable UTC due/reminder instant with raw offset provenance. |
| `loans.trustLevel` | TRANSFORM | Canonical debt trust/risk enum snapshot. |
| `loans.images` | TRANSFORM | Asset/attachment provenance rows. |
| `loans.createdAt` | TRANSFORM | Debt/migration provenance UTC. |
| `loans.updatedAt` | ARCHIVE | Immutable posted debt origin; later mutable legacy value is provenance. |
| `loans._destroy` | TRANSFORM | Debt lifecycle/archive state; financial history RESTRICT. |
| `borrowings._id` | TRANSFORM | `DebtAgreement.legacy_mongo_id` for payable. |
| `borrowings.transactionId` | TRANSFORM | Unique originating financial transaction link. |
| `borrowings.moneyTargetType` | TRANSFORM | Borrowing receipt target discriminator. |
| `borrowings.moneyTargetId` | TRANSFORM | Resolve receipt ledger account. |
| `borrowings.lenderId` | TRANSFORM | Resolve space-scoped `Contact`. |
| `borrowings.rate` | TRANSFORM | Decimal rate value with `rate_basis=UNSPECIFIED` absent stronger evidence. |
| `borrowings.repaymentTime` | TRANSFORM | Nullable UTC due/reminder instant with raw offset provenance. |
| `borrowings.images` | TRANSFORM | Asset/attachment provenance rows. |
| `borrowings.createdAt` | TRANSFORM | Debt/migration provenance UTC. |
| `borrowings.updatedAt` | ARCHIVE | Immutable posted debt origin; legacy value is provenance. |
| `borrowings._destroy` | TRANSFORM | Debt lifecycle/archive state; financial history RESTRICT. |
| `collections._id` | TRANSFORM | Collection settlement fact `legacy_mongo_id`. |
| `collections.transactionId` | TRANSFORM | Unique collection financial transaction link. |
| `collections.loanTransactionId` | TRANSFORM | Resolve original receivable `DebtAgreement` by origin transaction. |
| `collections.borrowerId` | TRANSFORM | Resolve contact from ObjectId/string only when 24-hex and target exists. |
| `collections.moneyTargetType` | TRANSFORM | Settlement target discriminator. |
| `collections.moneyTargetId` | TRANSFORM | Resolve settlement target ledger account. |
| `collections.realCollectTime` | TRANSFORM | Settlement `occurred_at` UTC; reconcile with header time. |
| `collections.images` | TRANSFORM | Asset/attachment provenance rows. |
| `collections.createdAt` | TRANSFORM | Settlement/migration provenance UTC. |
| `collections.updatedAt` | ARCHIVE | Posted settlement immutable; legacy value is provenance. |
| `collections._destroy` | TRANSFORM | Settlement migration state; history RESTRICT. |
| `repayments._id` | TRANSFORM | Repayment settlement fact `legacy_mongo_id`. |
| `repayments.transactionId` | TRANSFORM | Unique repayment financial transaction link. |
| `repayments.borrowingTransactionId` | TRANSFORM | Resolve original payable `DebtAgreement` by origin transaction. |
| `repayments.lenderId` | TRANSFORM | Resolve contact from ObjectId/string only when 24-hex and target exists. |
| `repayments.moneyFromType` | TRANSFORM | Settlement source discriminator. |
| `repayments.moneyFromId` | TRANSFORM | Resolve settlement source ledger account. |
| `repayments.realRepaymentTime` | TRANSFORM | Settlement `occurred_at` UTC; reconcile with header time. |
| `repayments.images` | TRANSFORM | Asset/attachment provenance rows. |
| `repayments.createdAt` | TRANSFORM | Settlement/migration provenance UTC. |
| `repayments.updatedAt` | ARCHIVE | Posted settlement immutable; legacy value is provenance. |
| `repayments._destroy` | TRANSFORM | Settlement migration state; history RESTRICT. |

### 2.5 Contacts, budgets and notifications

| Source path | Action | Logical target / rule |
|---|---|---|
| `contacts._id` | TRANSFORM | `Contact.legacy_mongo_id`. |
| `contacts.ownerType` | TRANSFORM | Companion discriminator for contact space. |
| `contacts.ownerId` | TRANSFORM | Resolve `Contact.financial_space_id`. |
| `contacts.name` | MIGRATE | `Contact.name`; duplicates only assessed inside same space. |
| `contacts.trustLevel` | TRANSFORM | Canonical contact trust enum. |
| `contacts.createdAt` | TRANSFORM | `Contact.created_at` UTC. |
| `contacts.updatedAt` | TRANSFORM | `Contact.updated_at` UTC nullable. |
| `contacts._destroy` | TRANSFORM | `Contact.deleted_at`; debt reference RESTRICT. |
| `budgets._id` | TRANSFORM | `Budget.legacy_mongo_id`. |
| `budgets.ownerType` | TRANSFORM | Companion discriminator for budget space. |
| `budgets.ownerId` | TRANSFORM | Resolve `Budget.financial_space_id`. |
| `budgets.startTime` | TRANSFORM | `Budget.starts_at` UTC; preserve original boundary representation. |
| `budgets.endTime` | TRANSFORM | `Budget.ends_at` UTC; validate ordered closed/open interval policy. |
| `budgets.categories` | TRANSFORM | Split ordered embedded documents into `BudgetAllocation`; raw array archived for replay. |
| `budgets.categories[].categoryId` | TRANSFORM | `BudgetAllocation.category_id`; same-space FK. |
| `budgets.categories[].categoryName` | MIGRATE | `BudgetAllocation.category_name_snapshot`. |
| `budgets.categories[].icon` | MIGRATE | `BudgetAllocation.icon_snapshot` nullable. |
| `budgets.categories[].childrenIds` | ARCHIVE | Copied graph evidence; canonical graph comes from `CategoryEdge`. |
| `budgets.categories[].parentIds` | ARCHIVE | Copied graph evidence; canonical graph comes from `CategoryEdge`. |
| `budgets.categories[].amount` | MIGRATE | `BudgetAllocation.amount` VND integer. |
| `budgets.categories[].repeat` | MIGRATE | `BudgetAllocation.repeat_enabled`. |
| `budgets.categories[].transactionIds` | ARCHIVE | Reverse spend evidence; target spend derives from transaction category/time. |
| `budgets.createdAt` | TRANSFORM | `Budget.created_at` UTC. |
| `budgets.updatedAt` | TRANSFORM | `Budget.updated_at` UTC nullable. |
| `budgets._destroy` | TRANSFORM | Budget lifecycle/soft-delete. |
| `notifications._id` | TRANSFORM | `Notification.legacy_mongo_id`. |
| `notifications.title` | MIGRATE | `Notification.title`. |
| `notifications.message` | MIGRATE | `Notification.message`. |
| `notifications.type` | TRANSFORM | Canonical notification type enum. |
| `notifications.link` | MIGRATE | `Notification.link` nullable; sanitize/validate at API boundary later. |
| `notifications.createdAt` | TRANSFORM | `Notification.created_at` UTC. |
| `notifications.updatedAt` | ARCHIVE | Immutable content provenance. |
| `notifications._destroy` | TRANSFORM | Notification archive state. |
| `user_notifications._id` | TRANSFORM | `UserNotification.legacy_mongo_id`. |
| `user_notifications.userId` | TRANSFORM | `UserNotification.user_id` FK. |
| `user_notifications.notificationId` | TRANSFORM | `UserNotification.notification_id` FK. |
| `user_notifications.isRead` | MIGRATE | `UserNotification.is_read`. |
| `user_notifications.readAt` | TRANSFORM | `UserNotification.read_at` UTC nullable; must agree with read state. |
| `user_notifications.receiveAt` | TRANSFORM | `UserNotification.received_at` UTC. |

### 2.6 Schema-only/absent collections

Wave 0 found these collections absent/empty in the profiled database and no active persistence producer. Their declared fields are still mapped 100%; the controlled load archives any later discovered row and raises `SCHEMA_ONLY_RECORD_DISCOVERED` rather than activating unreviewed business behavior.

| Source path | Action | Logical target / rule |
|---|---|---|
| `contribution_requests._id` | ARCHIVE | Legacy record identity in immutable migration archive. |
| `contribution_requests.ownerType` | ARCHIVE | Raw owner discriminator; resolve only for discrepancy evidence. |
| `contribution_requests.ownerId` | ARCHIVE | Raw owner relation evidence. |
| `contribution_requests.familyId` | ARCHIVE | Raw family relation evidence. |
| `contribution_requests.name` | ARCHIVE | Legacy request payload. |
| `contribution_requests.description` | ARCHIVE | Legacy request payload. |
| `contribution_requests.amount` | ARCHIVE | Raw VND request value; does not create posting. |
| `contribution_requests.moneyTargetType` | ARCHIVE | Raw target discriminator. |
| `contribution_requests.moneyTargetId` | ARCHIVE | Raw target relation. |
| `contribution_requests.deadline` | ARCHIVE | Raw deadline/time provenance. |
| `contribution_requests.contributerIds` | ARCHIVE | Raw misspelled contributor array; validate only for report. |
| `contribution_requests.createdAt` | ARCHIVE | Raw audit time. |
| `contribution_requests.updatedAt` | ARCHIVE | Raw audit time. |
| `contribution_requests._destroy` | ARCHIVE | Raw lifecycle flag. |
| `group_payouts._id` | ARCHIVE | Legacy record identity in immutable migration archive. |
| `group_payouts.transactionId` | ARCHIVE | Raw transaction relation; no posting emitted. |
| `group_payouts.recipientId` | ARCHIVE | Raw user recipient relation. |
| `group_payouts.moneyFromType` | ARCHIVE | Raw source discriminator. |
| `group_payouts.moneyFromId` | ARCHIVE | Raw source relation. |
| `group_payouts.moneyTargetType` | ARCHIVE | Raw target discriminator. |
| `group_payouts.moneyTargetId` | ARCHIVE | Raw target relation. |
| `group_payouts.images` | ARCHIVE | Raw URL array; no provider ownership fabricated. |
| `group_payouts.createdAt` | ARCHIVE | Raw audit time. |
| `group_payouts.updatedAt` | ARCHIVE | Raw audit time. |
| `group_payouts._destroy` | ARCHIVE | Raw lifecycle flag. |
| `invitations._id` | ARCHIVE | Legacy record identity in immutable migration archive. |
| `invitations.inviterId` | ARCHIVE | Raw user relation. |
| `invitations.inviteeId` | ARCHIVE | Raw user relation. |
| `invitations.familyId` | ARCHIVE | Raw family relation. |
| `invitations.status` | ARCHIVE | Raw status; broken unrelated time validator is ignored. |
| `invitations.createdAt` | ARCHIVE | Raw audit time. |
| `invitations.updatedAt` | ARCHIVE | Raw audit time. |
| `invitations._destroy` | ARCHIVE | Raw lifecycle flag. |
| `proposal_expenses._id` | ARCHIVE | Legacy record identity in immutable migration archive. |
| `proposal_expenses.ownerType` | ARCHIVE | Raw owner discriminator. |
| `proposal_expenses.ownerId` | ARCHIVE | Raw owner relation. |
| `proposal_expenses.targetId` | ARCHIVE | Raw family target relation. |
| `proposal_expenses.name` | ARCHIVE | Legacy proposal payload. |
| `proposal_expenses.amount` | ARCHIVE | Raw VND amount; no posting emitted. |
| `proposal_expenses.categoryId` | ARCHIVE | Raw category relation. |
| `proposal_expenses.description` | ARCHIVE | Legacy proposal payload. |
| `proposal_expenses.status` | ARCHIVE | Raw review state. |
| `proposal_expenses.images` | ARCHIVE | Raw URL array; no provider ownership fabricated. |
| `proposal_expenses.reviewerId` | ARCHIVE | Raw reviewer relation. |
| `proposal_expenses.reviewed_at` | ARCHIVE | Raw review time and naming provenance. |
| `proposal_expenses.createdAt` | ARCHIVE | Raw audit time. |
| `proposal_expenses.updatedAt` | ARCHIVE | Raw audit time. |
| `proposal_expenses._destroy` | ARCHIVE | Raw lifecycle flag. |
| `system_tasks._id` | ARCHIVE | Legacy application-schema identity; never treated as Agenda document identity. |
| `system_tasks.type` | ARCHIVE | Raw declared application task type. |
| `system_tasks.data` | ARCHIVE | Opaque raw payload; no execution or unversioned job migration. |
| `system_tasks.scheduleTime` | ARCHIVE | Raw schedule intent time. |
| `system_tasks.repeat` | ARCHIVE | Raw repeat flag. |
| `system_tasks.status` | ARCHIVE | Raw status. |
| `system_tasks.createdAt` | ARCHIVE | Raw audit time. |
| `system_tasks.updatedAt` | ARCHIVE | Raw audit time. |
| `system_tasks._destroy` | ARCHIVE | Raw lifecycle flag. |

## 3. Cross-field transforms and reject rules

| Rule | Input | Output | Blocking/review behavior |
|---|---|---|---|
| `MAP-ID` | `_id` | unique legacy ID + generated identities | Invalid/duplicate identity is blocking for owned/financial data. |
| `MAP-SPACE` | `ownerType`, `ownerId`, family memberships | `financial_space_id` and membership FKs | Unknown owner type, missing owner or unauthorized cross-space edge is blocking. |
| `MAP-MONEY-REF` | `{moneyFrom|moneyTarget|interestPaidTarget}{Type,Id}` | typed target + ledger account FK | Pair mismatch/orphan is blocking; never resolve by ID alone. |
| `MAP-MONEY` | JavaScript number | VND integer | Fraction, non-finite or unsafe integer is blocking; tolerance remains 0 VND. |
| `MAP-RATE` | JavaScript number | decimal rate + explicit basis | Saving basis is annual; debt basis defaults `UNSPECIFIED`; invalid range is blocking. |
| `MAP-TIME` | BSON Date, epoch or ISO | UTC instant/business date + provenance | Invalid/ambiguous financial time blocks; no hard-coded +7 compensation. |
| `MAP-DETAIL` | transaction header + one detail record | typed immutable transaction facts | Missing, duplicate or mismatched detail type is blocking. |
| `MAP-BALANCE` | init/stored balance + reconstructed history | opening anchor + ledger projection | Difference other than 0 VND blocks; no synthetic adjustment. |
| `MAP-ASSET` | URL array/scalar | asset/attachment or legacy external URL | Missing provider identity produces review case, not invented ownership/deletion. |
| `MAP-SCHEMA-ONLY` | any row in absent/empty schema-only collection | immutable archive + discrepancy | Does not enable endpoint, job or posting automatically. |

## 4. Coverage accounting

Coverage unit is a distinct source path, including implicit MongoDB `_id`, expanded audit fields and each embedded `budgets.categories[]` field. A field appearing in several collections is counted once per collection path.

| Metric | Expected | Review result |
|---|---:|---:|
| Source-declared collections | 26 | 26 |
| Source field paths | 305 | 305 |
| Paths with exactly one action | 305 | 305 |
| Unclassified action | 0 | 0 |
| Allowed actions | 4 | `MIGRATE`, `TRANSFORM`, `ARCHIVE`, `DROP` |

## 5. Decision boundaries

- OPEN-006 affects only the approved postings for mapped `transfers.fee`; the source value itself is preserved.
- OPEN-007 affects debt settlement constraints/posting allocation; all source debt/settlement facts are preserved.
- OPEN-008 affects command validation and zero-value migration classification; no zero ledger entry is generated by mapping.
- OPEN-009 does not promote empty schema-only family flows; records, if discovered, are archived/reviewed.
- OPEN-010 controls whether direct legacy saving interest can become an explicit migration posting.
- OPEN-011 controls cross-space commands; unresolved cross-space records are discrepancies, never silently reassigned.

## 6. W2-02 review checklist

- [x] Automated field row count equals the 305-path source inventory.
- [x] Every row has exactly one allowed action: 190 transform, 29 migrate, 85 archive, 1 security drop.
- [x] All 26 collections have at least one row and `_id` disposition.
- [x] Embedded/array paths and mixed BSON debt contact fields are explicit.
- [x] Dependency graph and load/reconciliation checkpoints reviewed.
- [x] `git diff --check` passes before W2-02 is completed.
