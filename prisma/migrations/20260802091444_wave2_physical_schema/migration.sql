-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "week_day" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "token_family_status" AS ENUM ('ACTIVE', 'REVOKED', 'COMPROMISED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "session_status" AS ENUM ('ACTIVE', 'ROTATED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "financial_space_kind" AS ENUM ('PERSONAL', 'FAMILY');

-- CreateEnum
CREATE TYPE "financial_space_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "membership_role" AS ENUM ('OWNER', 'MANAGER', 'MEMBER');

-- CreateEnum
CREATE TYPE "membership_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'LEFT');

-- CreateEnum
CREATE TYPE "category_transaction_type" AS ENUM ('EXPENSE', 'INCOME', 'LOAN', 'COLLECT', 'BORROWING', 'REPAYMENT', 'TRANSFER', 'CONTRIBUTION');

-- CreateEnum
CREATE TYPE "financial_transaction_type" AS ENUM ('ACCOUNT_OPENING', 'ACCUMULATION_OPENING', 'INCOME', 'EXPENSE', 'TRANSFER', 'CONTRIBUTION', 'LOAN_DISBURSEMENT', 'BORROWING', 'REPAYMENT', 'COLLECTION', 'ACCUMULATION_CLOSE', 'SAVING_DEPOSIT', 'SAVING_INTEREST_MONTHLY', 'SAVING_INTEREST_MATURITY', 'SAVING_CLOSE', 'SAVING_ROLLOVER_PRINCIPAL', 'SAVING_ROLLOVER_PRINCIPAL_INTEREST', 'REVERSAL');

-- CreateEnum
CREATE TYPE "trust_level" AS ENUM ('NORMAL', 'GOOD', 'WARNING', 'BAD');

-- CreateEnum
CREATE TYPE "account_type" AS ENUM ('WALLET', 'BANK', 'OTHER');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('ACTIVE', 'BLOCKED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "accumulation_status" AS ENUM ('ACTIVE', 'FINISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "saving_interest_schedule" AS ENUM ('MATURITY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "saving_maturity_action" AS ENUM ('CLOSE_ACCOUNT', 'ROLL_OVER_PRINCIPAL', 'ROLL_OVER_PRINCIPAL_AND_INTEREST');

-- CreateEnum
CREATE TYPE "interest_day_count_convention" AS ENUM ('ACTUAL_365');

-- CreateEnum
CREATE TYPE "money_rounding_mode" AS ENUM ('HALF_UP');

-- CreateEnum
CREATE TYPE "saving_status" AS ENUM ('ACTIVE', 'CLOSED', 'ROLLED_OVER', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "saving_period_action" AS ENUM ('MONTHLY_INTEREST', 'MATURITY_INTEREST', 'CLOSE', 'ROLLOVER_PRINCIPAL', 'ROLLOVER_PRINCIPAL_INTEREST');

-- CreateEnum
CREATE TYPE "saving_period_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "saving_transaction_action" AS ENUM ('DEPOSIT', 'MONTHLY_INTEREST', 'MATURITY_INTEREST', 'CLOSE', 'ROLLOVER_PRINCIPAL', 'ROLLOVER_PRINCIPAL_INTEREST');

-- CreateEnum
CREATE TYPE "budget_status" AS ENUM ('ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "financial_transaction_status" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "interspace_transfer_status" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "debt_direction" AS ENUM ('RECEIVABLE', 'PAYABLE');

-- CreateEnum
CREATE TYPE "debt_rate_basis" AS ENUM ('ANNUAL_PERCENT', 'MONTHLY_PERCENT', 'FIXED_AMOUNT', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "debt_status" AS ENUM ('OPEN', 'PARTIALLY_SETTLED', 'SETTLED', 'WRITTEN_OFF', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('LINK', 'TEXT', 'INVITATION');

-- CreateEnum
CREATE TYPE "ledger_normal_side" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "ledger_account_kind" AS ENUM ('USER_BALANCE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ledger_account_status" AS ENUM ('ACTIVE', 'BLOCKED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "posting_template_status" AS ENUM ('APPROVED', 'RETIRED');

-- CreateEnum
CREATE TYPE "posting_sign_rule" AS ENUM ('POSITIVE', 'NEGATIVE', 'VARIABLE');

-- CreateEnum
CREATE TYPE "snapshot_trigger_type" AS ENUM ('SCHEDULED', 'MANUAL', 'CATCH_UP', 'REBUILD');

-- CreateEnum
CREATE TYPE "snapshot_run_status" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "balance_snapshot_status" AS ENUM ('VALID', 'FAILED', 'STALE', 'REBUILDING', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "idempotency_actor_type" AS ENUM ('USER', 'JOB', 'ADMIN', 'MIGRATION');

-- CreateEnum
CREATE TYPE "idempotency_status" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED_FINAL');

-- CreateEnum
CREATE TYPE "outbox_status" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'DEAD_LETTER', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "delivery_attempt_status" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "asset_provider" AS ENUM ('CLOUDINARY', 'LEGACY_EXTERNAL', 'TEST');

-- CreateEnum
CREATE TYPE "temporary_asset_status" AS ENUM ('TEMPORARY', 'LINKED', 'ACTIVE', 'EXPIRED', 'QUARANTINED', 'DELETED', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "attachment_status" AS ENUM ('PENDING', 'ACTIVE', 'REPLACED', 'REMOVED', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "migration_run_type" AS ENUM ('SAMPLE', 'DRY_RUN', 'REHEARSAL', 'FINAL');

-- CreateEnum
CREATE TYPE "migration_run_status" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "migration_record_disposition" AS ENUM ('STAGED', 'LOADED', 'ARCHIVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "checkpoint_status" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "discrepancy_source" AS ENUM ('MIGRATION', 'RECONCILIATION', 'SNAPSHOT', 'OUTBOX', 'JOB');

-- CreateEnum
CREATE TYPE "discrepancy_severity" AS ENUM ('BLOCKING', 'REQUIRES_REVIEW', 'AUTO_FIX_SAFE', 'INFO');

-- CreateEnum
CREATE TYPE "discrepancy_status" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "audit_actor_type" AS ENUM ('USER', 'ADMIN', 'JOB', 'MIGRATION', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_mongo_id" CHAR(24),
    "email" VARCHAR(320) NOT NULL,
    "email_normalized" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "username_normalized" VARCHAR(64) NOT NULL,
    "display_name" VARCHAR(256) NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'INACTIVE',
    "avatar_attachment_id" BIGINT,
    "language_code" VARCHAR(16) NOT NULL DEFAULT 'vi',
    "currency_code" CHAR(3) NOT NULL DEFAULT 'VND',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "reminder_enabled" BOOLEAN NOT NULL DEFAULT true,
    "reminder_local_time" TIME(0),
    "week_start" "week_day" NOT NULL DEFAULT 'MONDAY',
    "month_start_day" SMALLINT NOT NULL DEFAULT 1,
    "auth_version" INTEGER NOT NULL DEFAULT 2,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_families" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" BIGINT NOT NULL,
    "status" "token_family_status" NOT NULL DEFAULT 'ACTIVE',
    "created_ip_hash" CHAR(64),
    "user_agent_hash" CHAR(64),
    "revoked_reason" VARCHAR(256),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "token_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token_family_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "refresh_token_hash" CHAR(64) NOT NULL,
    "status" "session_status" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_used_at" TIMESTAMPTZ(6),
    "replaced_by_session_id" BIGINT,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_reason" VARCHAR(256),
    "csrf_secret_hash" CHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_spaces" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_mongo_id" CHAR(24),
    "kind" "financial_space_kind" NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "status" "financial_space_status" NOT NULL DEFAULT 'ACTIVE',
    "background_attachment_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "financial_spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_space_memberships" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "financial_space_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "role" "membership_role" NOT NULL,
    "status" "membership_status" NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "source_ref" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "financial_space_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banks" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_mongo_id" CHAR(24),
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "logo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_mongo_id" CHAR(24),
    "financial_space_id" BIGINT NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "transaction_type" "category_transaction_type" NOT NULL,
    "is_system_locked" BOOLEAN NOT NULL DEFAULT false,
    "icon" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_edges" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "financial_space_id" BIGINT NOT NULL,
    "parent_category_id" BIGINT NOT NULL,
    "child_category_id" BIGINT NOT NULL,
    "source_ref" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "category_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_mongo_id" CHAR(24),
    "financial_space_id" BIGINT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "trust_level" "trust_level" NOT NULL DEFAULT 'NORMAL',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_mongo_id" CHAR(24),
    "financial_space_id" BIGINT NOT NULL,
    "bank_id" BIGINT,
    "type" "account_type" NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "status" "account_status" NOT NULL DEFAULT 'ACTIVE',
    "legacy_initial_balance" BIGINT NOT NULL,
    "legacy_stored_balance" BIGINT NOT NULL,
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accumulations" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_mongo_id" CHAR(24),
    "financial_space_id" BIGINT NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "description" TEXT,
    "target_amount" BIGINT NOT NULL,
    "legacy_stored_balance" BIGINT NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "accumulation_status" NOT NULL DEFAULT 'ACTIVE',
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "accumulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings_accounts" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_mongo_id" CHAR(24),
    "financial_space_id" BIGINT NOT NULL,
    "bank_id" BIGINT NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "description" TEXT,
    "principal_amount" BIGINT NOT NULL,
    "legacy_stored_balance" BIGINT NOT NULL,
    "annual_rate" DECIMAL(7,4) NOT NULL,
    "non_term_annual_rate" DECIMAL(7,4) NOT NULL,
    "day_count_convention" "interest_day_count_convention" NOT NULL DEFAULT 'ACTUAL_365',
    "rounding_mode" "money_rounding_mode" NOT NULL DEFAULT 'HALF_UP',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "term_months" INTEGER NOT NULL,
    "interest_schedule" "saving_interest_schedule" NOT NULL,
    "maturity_action" "saving_maturity_action" NOT NULL,
    "funding_ledger_account_id" BIGINT NOT NULL,
    "interest_target_ledger_account_id" BIGINT,
    "parent_saving_id" BIGINT,
    "status" "saving_status" NOT NULL DEFAULT 'ACTIVE',
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "savings_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saving_periods" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "saving_account_id" BIGINT NOT NULL,
    "period_ordinal" INTEGER NOT NULL,
    "action" "saving_period_action" NOT NULL,
    "due_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "saving_period_status" NOT NULL DEFAULT 'PENDING',
    "financial_transaction_id" BIGINT,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "saving_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_mongo_id" CHAR(24),
    "financial_space_id" BIGINT NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "budget_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_allocations" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "budget_id" BIGINT NOT NULL,
    "category_id" BIGINT NOT NULL,
    "source_ordinal" INTEGER NOT NULL,
    "category_name_snapshot" VARCHAR(256) NOT NULL,
    "icon_snapshot" TEXT,
    "amount" BIGINT NOT NULL,
    "repeat_enabled" BOOLEAN NOT NULL DEFAULT false,
    "source_ref" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "budget_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transactions" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_mongo_id" CHAR(24),
    "financial_space_id" BIGINT NOT NULL,
    "posting_template_definition_id" BIGINT NOT NULL,
    "type" "financial_transaction_type" NOT NULL,
    "status" "financial_transaction_status" NOT NULL DEFAULT 'DRAFT',
    "responsible_user_id" BIGINT NOT NULL,
    "category_id" BIGINT,
    "name" VARCHAR(256) NOT NULL,
    "description" VARCHAR(256),
    "amount" BIGINT NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "posted_at" TIMESTAMPTZ(6),
    "reverses_transaction_id" BIGINT,
    "business_snapshot" JSONB NOT NULL,
    "snapshot_schema_version" INTEGER NOT NULL,
    "idempotency_record_id" BIGINT,
    "correlation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_expense_details" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_mongo_id" CHAR(24),
    "financial_transaction_id" BIGINT NOT NULL,
    "source_ledger_account_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "transaction_expense_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_income_details" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_mongo_id" CHAR(24),
    "financial_transaction_id" BIGINT NOT NULL,
    "target_ledger_account_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "transaction_income_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_transfer_details" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_mongo_id" CHAR(24),
    "financial_transaction_id" BIGINT NOT NULL,
    "source_ledger_account_id" BIGINT NOT NULL,
    "target_ledger_account_id" BIGINT NOT NULL,
    "fee_amount" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "transaction_transfer_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interspace_transfer_groups" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_mongo_id" CHAR(24),
    "source_financial_space_id" BIGINT NOT NULL,
    "target_financial_space_id" BIGINT NOT NULL,
    "actor_user_id" BIGINT NOT NULL,
    "source_ledger_account_id" BIGINT NOT NULL,
    "target_ledger_account_id" BIGINT NOT NULL,
    "source_transaction_id" BIGINT NOT NULL,
    "target_transaction_id" BIGINT NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" "interspace_transfer_status" NOT NULL DEFAULT 'DRAFT',
    "idempotency_record_id" BIGINT NOT NULL,
    "legacy_transaction_mongo_id" CHAR(24),
    "legacy_contribution_request_id" CHAR(24),
    "correlation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "interspace_transfer_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_agreements" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_mongo_id" CHAR(24),
    "financial_space_id" BIGINT NOT NULL,
    "origin_transaction_id" BIGINT NOT NULL,
    "direction" "debt_direction" NOT NULL,
    "cash_ledger_account_id" BIGINT NOT NULL,
    "debt_ledger_account_id" BIGINT NOT NULL,
    "counterparty_contact_id" BIGINT NOT NULL,
    "principal_amount" BIGINT NOT NULL,
    "rate_value" DECIMAL(7,4),
    "fixed_interest_amount" BIGINT,
    "rate_basis" "debt_rate_basis" NOT NULL,
    "due_at" TIMESTAMPTZ(6),
    "trust_level" "trust_level" NOT NULL DEFAULT 'NORMAL',
    "status" "debt_status" NOT NULL DEFAULT 'OPEN',
    "outstanding_principal" BIGINT NOT NULL,
    "outstanding_interest" BIGINT NOT NULL DEFAULT 0,
    "settled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "debt_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_settlements" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_mongo_id" CHAR(24),
    "financial_space_id" BIGINT NOT NULL,
    "financial_transaction_id" BIGINT NOT NULL,
    "debt_agreement_id" BIGINT NOT NULL,
    "cash_ledger_account_id" BIGINT NOT NULL,
    "principal_amount" BIGINT NOT NULL,
    "interest_amount" BIGINT NOT NULL DEFAULT 0,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "debt_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_saving_details" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "financial_transaction_id" BIGINT NOT NULL,
    "saving_account_id" BIGINT NOT NULL,
    "saving_period_id" BIGINT,
    "action" "saving_transaction_action" NOT NULL,
    "source_ledger_account_id" BIGINT,
    "target_ledger_account_id" BIGINT,
    "principal_amount" BIGINT NOT NULL DEFAULT 0,
    "interest_amount" BIGINT NOT NULL DEFAULT 0,
    "calculation_snapshot" JSONB NOT NULL,
    "calculation_version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "transaction_saving_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_anchor_details" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "financial_transaction_id" BIGINT NOT NULL,
    "ledger_account_id" BIGINT NOT NULL,
    "migration_run_id" BIGINT NOT NULL,
    "discrepancy_case_id" BIGINT,
    "source_legacy_balance" BIGINT NOT NULL,
    "reconstructed_balance" BIGINT NOT NULL,
    "difference_amount" BIGINT NOT NULL,
    "source_checksum" CHAR(64) NOT NULL,
    "approval_actor_user_id" BIGINT NOT NULL,
    "approval_reason" TEXT NOT NULL,
    "approved_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "migration_anchor_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_mongo_id" CHAR(24),
    "type" "notification_type" NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "financial_space_id" BIGINT,
    "source_outbox_event_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notifications" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_mongo_id" CHAR(24),
    "user_id" BIGINT NOT NULL,
    "notification_id" BIGINT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_account_definitions" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(64) NOT NULL,
    "normal_side" "ledger_normal_side" NOT NULL,
    "allows_negative_balance" BOOLEAN NOT NULL,
    "description" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "system_account_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posting_template_definitions" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(64) NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "posting_template_status" NOT NULL,
    "definition_hash" CHAR(64) NOT NULL,
    "effective_at" TIMESTAMPTZ(6) NOT NULL,
    "retired_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "posting_template_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posting_template_entry_roles" (
    "id" BIGSERIAL NOT NULL,
    "posting_template_definition_id" BIGINT NOT NULL,
    "entry_role" VARCHAR(64) NOT NULL,
    "required_account_kind" "ledger_account_kind" NOT NULL,
    "required_system_role" VARCHAR(64),
    "sign_rule" "posting_sign_rule" NOT NULL,
    "minimum_occurrences" SMALLINT NOT NULL DEFAULT 1,
    "maximum_occurrences" SMALLINT NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "posting_template_entry_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "financial_space_id" BIGINT NOT NULL,
    "kind" "ledger_account_kind" NOT NULL,
    "normal_side" "ledger_normal_side" NOT NULL,
    "system_role" VARCHAR(64),
    "account_id" BIGINT,
    "accumulation_id" BIGINT,
    "saving_account_id" BIGINT,
    "name" VARCHAR(256) NOT NULL,
    "current_balance" BIGINT NOT NULL DEFAULT 0,
    "current_sequence" BIGINT NOT NULL DEFAULT 0,
    "allows_negative_balance" BOOLEAN NOT NULL DEFAULT false,
    "status" "ledger_account_status" NOT NULL DEFAULT 'ACTIVE',
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "financial_transaction_id" BIGINT NOT NULL,
    "ledger_account_id" BIGINT NOT NULL,
    "account_sequence" BIGINT NOT NULL,
    "amount" BIGINT NOT NULL,
    "balance_before" BIGINT NOT NULL,
    "balance_after" BIGINT NOT NULL,
    "posted_at" TIMESTAMPTZ(6) NOT NULL,
    "entry_role" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_snapshot_runs" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "financial_space_id" BIGINT NOT NULL,
    "business_date" DATE NOT NULL,
    "trigger_type" "snapshot_trigger_type" NOT NULL,
    "status" "snapshot_run_status" NOT NULL,
    "calculation_version" INTEGER NOT NULL,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "accounts_total" INTEGER NOT NULL DEFAULT 0,
    "accounts_succeeded" INTEGER NOT NULL DEFAULT 0,
    "accounts_failed" INTEGER NOT NULL DEFAULT 0,
    "error_summary" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "balance_snapshot_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_balance_snapshots" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "snapshot_run_id" BIGINT NOT NULL,
    "ledger_account_id" BIGINT NOT NULL,
    "financial_space_id" BIGINT NOT NULL,
    "business_date" DATE NOT NULL,
    "period_start_utc" TIMESTAMPTZ(6) NOT NULL,
    "period_end_utc" TIMESTAMPTZ(6) NOT NULL,
    "opening_balance" BIGINT NOT NULL,
    "total_inflow" BIGINT NOT NULL,
    "total_outflow" BIGINT NOT NULL,
    "closing_balance" BIGINT NOT NULL,
    "first_entry_sequence" BIGINT,
    "last_entry_sequence" BIGINT,
    "cutoff_sequence" BIGINT NOT NULL,
    "cutoff_posted_at" TIMESTAMPTZ(6) NOT NULL,
    "entry_count" INTEGER NOT NULL,
    "calculation_version" INTEGER NOT NULL,
    "checksum" CHAR(64) NOT NULL,
    "status" "balance_snapshot_status" NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "superseded_by_id" BIGINT,
    "superseded_at" TIMESTAMPTZ(6),
    "generated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "account_balance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "financial_space_id" BIGINT NOT NULL,
    "actor_type" "idempotency_actor_type" NOT NULL,
    "actor_id" VARCHAR(128) NOT NULL,
    "operation" VARCHAR(96) NOT NULL,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "status" "idempotency_status" NOT NULL,
    "resource_type" VARCHAR(64),
    "resource_public_id" UUID,
    "response_status" SMALLINT,
    "response_body" JSONB,
    "error_code" VARCHAR(96),
    "lease_owner" VARCHAR(128),
    "lease_expires_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "response_purge_after" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "financial_space_id" BIGINT,
    "aggregate_type" VARCHAR(64) NOT NULL,
    "aggregate_public_id" UUID NOT NULL,
    "aggregate_sequence" BIGINT NOT NULL,
    "event_type" VARCHAR(96) NOT NULL,
    "event_schema_version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "outbox_status" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "lease_owner" VARCHAR(128),
    "lease_expires_at" TIMESTAMPTZ(6),
    "last_error_code" VARCHAR(96),
    "last_error_summary" TEXT,
    "delivered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_delivery_attempts" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "outbox_event_id" BIGINT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "provider_idempotency_key" VARCHAR(200) NOT NULL,
    "status" "delivery_attempt_status" NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "finished_at" TIMESTAMPTZ(6),
    "error_code" VARCHAR(96),
    "error_summary" TEXT,
    "provider_receipt" JSONB,

    CONSTRAINT "outbox_delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_receipts" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "consumer" VARCHAR(96) NOT NULL,
    "event_public_id" UUID NOT NULL,
    "event_schema_version" INTEGER NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "result" JSONB,

    CONSTRAINT "inbox_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temporary_assets" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legacy_mongo_id" CHAR(24),
    "owner_user_id" BIGINT NOT NULL,
    "financial_space_id" BIGINT,
    "upload_session_id" UUID NOT NULL,
    "provider" "asset_provider" NOT NULL,
    "provider_public_id" VARCHAR(512),
    "provider_resource_type" VARCHAR(64),
    "secure_url" TEXT NOT NULL,
    "checksum_sha256" CHAR(64),
    "content_type" VARCHAR(128),
    "size_bytes" BIGINT,
    "status" "temporary_asset_status" NOT NULL DEFAULT 'TEMPORARY',
    "expires_at" TIMESTAMPTZ(6),
    "activated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "source_provenance" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "temporary_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_id" BIGINT NOT NULL,
    "financial_space_id" BIGINT,
    "user_avatar_user_id" BIGINT,
    "space_background_space_id" BIGINT,
    "bank_logo_bank_id" BIGINT,
    "financial_transaction_id" BIGINT,
    "role" VARCHAR(64) NOT NULL,
    "source_ordinal" INTEGER NOT NULL DEFAULT 0,
    "status" "attachment_status" NOT NULL DEFAULT 'PENDING',
    "linked_by_user_id" BIGINT NOT NULL,
    "finalize_outbox_event_id" BIGINT,
    "activated_at" TIMESTAMPTZ(6),
    "removed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_runs" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "run_type" "migration_run_type" NOT NULL,
    "source_snapshot_id" VARCHAR(200) NOT NULL,
    "source_checksum" CHAR(64) NOT NULL,
    "mapping_version" VARCHAR(64) NOT NULL,
    "schema_version" VARCHAR(64) NOT NULL,
    "status" "migration_run_status" NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "source_count" BIGINT NOT NULL DEFAULT 0,
    "loaded_count" BIGINT NOT NULL DEFAULT 0,
    "rejected_count" BIGINT NOT NULL DEFAULT 0,
    "summary" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "migration_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_source_records" (
    "id" BIGSERIAL NOT NULL,
    "migration_run_id" BIGINT NOT NULL,
    "source_collection" VARCHAR(96) NOT NULL,
    "source_legacy_id" CHAR(24) NOT NULL,
    "source_hash" CHAR(64) NOT NULL,
    "raw_document" JSONB NOT NULL,
    "disposition" "migration_record_disposition" NOT NULL DEFAULT 'STAGED',
    "target_type" VARCHAR(64),
    "target_public_id" UUID,
    "reject_code" VARCHAR(96),
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "migration_source_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_checkpoints" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "migration_run_id" BIGINT NOT NULL,
    "graph_level" SMALLINT NOT NULL,
    "source_collection" VARCHAR(96) NOT NULL,
    "last_source_legacy_id" CHAR(24),
    "status" "checkpoint_status" NOT NULL,
    "processed_count" BIGINT NOT NULL DEFAULT 0,
    "loaded_count" BIGINT NOT NULL DEFAULT 0,
    "rejected_count" BIGINT NOT NULL DEFAULT 0,
    "canonical_hash" CHAR(64),
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "migration_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discrepancy_cases" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fingerprint" CHAR(64) NOT NULL,
    "source" "discrepancy_source" NOT NULL,
    "type" VARCHAR(96) NOT NULL,
    "severity" "discrepancy_severity" NOT NULL,
    "status" "discrepancy_status" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "recurrence_count" INTEGER NOT NULL DEFAULT 1,
    "financial_space_id" BIGINT,
    "migration_run_id" BIGINT,
    "resource_type" VARCHAR(64),
    "resource_public_id" UUID,
    "legacy_mongo_id" CHAR(24),
    "expected_data" JSONB,
    "actual_data" JSONB,
    "evidence" JSONB NOT NULL,
    "detected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "assigned_to_user_id" BIGINT,
    "resolution_action" VARCHAR(96),
    "resolution_note" TEXT,
    "resolved_by_user_id" BIGINT,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "discrepancy_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_type" "audit_actor_type" NOT NULL,
    "actor_public_id" UUID,
    "action" VARCHAR(96) NOT NULL,
    "resource_type" VARCHAR(64) NOT NULL,
    "resource_public_id" UUID,
    "financial_space_id" BIGINT,
    "correlation_id" UUID NOT NULL,
    "reason" TEXT,
    "before_data" JSONB,
    "after_data" JSONB,
    "evidence" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flag_overrides" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "deployment_environment" VARCHAR(32) NOT NULL,
    "flag_key" VARCHAR(96) NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "changed_by_user_id" BIGINT,
    "effective_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "feature_flag_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_public_id_key" ON "users"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_legacy_mongo_id_key" ON "users"("legacy_mongo_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users"("email_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_normalized_key" ON "users"("username_normalized");

-- CreateIndex
CREATE INDEX "users_status_id_idx" ON "users"("status", "id");

-- CreateIndex
CREATE UNIQUE INDEX "token_families_public_id_key" ON "token_families"("public_id");

-- CreateIndex
CREATE INDEX "token_families_user_id_status_created_at_idx" ON "token_families"("user_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "token_families_status_revoked_at_idx" ON "token_families"("status", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_public_id_key" ON "sessions"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_replaced_by_session_id_key" ON "sessions"("replaced_by_session_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_status_expires_at_idx" ON "sessions"("user_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "sessions_token_family_id_status_created_at_idx" ON "sessions"("token_family_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sessions_status_expires_at_idx" ON "sessions"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "financial_spaces_public_id_key" ON "financial_spaces"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_spaces_legacy_mongo_id_key" ON "financial_spaces"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "financial_spaces_kind_status_id_idx" ON "financial_spaces"("kind", "status", "id");

-- CreateIndex
CREATE INDEX "financial_spaces_status_created_at_id_idx" ON "financial_spaces"("status", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_space_memberships_public_id_key" ON "financial_space_memberships"("public_id");

-- CreateIndex
CREATE INDEX "financial_space_memberships_user_id_status_role_financial_s_idx" ON "financial_space_memberships"("user_id", "status", "role", "financial_space_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_space_memberships_financial_space_id_user_id_key" ON "financial_space_memberships"("financial_space_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "banks_public_id_key" ON "banks"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "banks_legacy_mongo_id_key" ON "banks"("legacy_mongo_id");

-- CreateIndex
CREATE UNIQUE INDEX "banks_code_key" ON "banks"("code");

-- CreateIndex
CREATE INDEX "banks_is_active_code_idx" ON "banks"("is_active", "code");

-- CreateIndex
CREATE UNIQUE INDEX "categories_public_id_key" ON "categories"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_legacy_mongo_id_key" ON "categories"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "categories_financial_space_id_transaction_type_deleted_at_i_idx" ON "categories"("financial_space_id", "transaction_type", "deleted_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "category_edges_public_id_key" ON "category_edges"("public_id");

-- CreateIndex
CREATE INDEX "category_edges_child_category_id_idx" ON "category_edges"("child_category_id");

-- CreateIndex
CREATE INDEX "category_edges_financial_space_id_parent_category_id_idx" ON "category_edges"("financial_space_id", "parent_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_edges_parent_category_id_child_category_id_key" ON "category_edges"("parent_category_id", "child_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_public_id_key" ON "contacts"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_legacy_mongo_id_key" ON "contacts"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "contacts_financial_space_id_deleted_at_name_id_idx" ON "contacts"("financial_space_id", "deleted_at", "name", "id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_public_id_key" ON "accounts"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_legacy_mongo_id_key" ON "accounts"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "accounts_financial_space_id_status_created_at_id_idx" ON "accounts"("financial_space_id", "status", "created_at", "id");

-- CreateIndex
CREATE INDEX "accounts_bank_id_idx" ON "accounts"("bank_id");

-- CreateIndex
CREATE UNIQUE INDEX "accumulations_public_id_key" ON "accumulations"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "accumulations_legacy_mongo_id_key" ON "accumulations"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "accumulations_financial_space_id_status_ends_at_id_idx" ON "accumulations"("financial_space_id", "status", "ends_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "savings_accounts_public_id_key" ON "savings_accounts"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "savings_accounts_legacy_mongo_id_key" ON "savings_accounts"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "savings_accounts_financial_space_id_status_starts_at_id_idx" ON "savings_accounts"("financial_space_id", "status", "starts_at", "id");

-- CreateIndex
CREATE INDEX "savings_accounts_status_starts_at_term_months_idx" ON "savings_accounts"("status", "starts_at", "term_months");

-- CreateIndex
CREATE INDEX "savings_accounts_bank_id_idx" ON "savings_accounts"("bank_id");

-- CreateIndex
CREATE INDEX "savings_accounts_funding_ledger_account_id_idx" ON "savings_accounts"("funding_ledger_account_id");

-- CreateIndex
CREATE INDEX "savings_accounts_interest_target_ledger_account_id_idx" ON "savings_accounts"("interest_target_ledger_account_id");

-- CreateIndex
CREATE INDEX "savings_accounts_parent_saving_id_idx" ON "savings_accounts"("parent_saving_id");

-- CreateIndex
CREATE UNIQUE INDEX "saving_periods_public_id_key" ON "saving_periods"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "saving_periods_idempotency_key_key" ON "saving_periods"("idempotency_key");

-- CreateIndex
CREATE INDEX "saving_periods_status_due_at_id_idx" ON "saving_periods"("status", "due_at", "id");

-- CreateIndex
CREATE INDEX "saving_periods_financial_transaction_id_idx" ON "saving_periods"("financial_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "saving_periods_saving_account_id_period_ordinal_action_key" ON "saving_periods"("saving_account_id", "period_ordinal", "action");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_public_id_key" ON "budgets"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_legacy_mongo_id_key" ON "budgets"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "budgets_financial_space_id_status_starts_at_ends_at_id_idx" ON "budgets"("financial_space_id", "status", "starts_at", "ends_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_allocations_public_id_key" ON "budget_allocations"("public_id");

-- CreateIndex
CREATE INDEX "budget_allocations_category_id_idx" ON "budget_allocations"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_allocations_budget_id_category_id_key" ON "budget_allocations"("budget_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_allocations_budget_id_source_ordinal_key" ON "budget_allocations"("budget_id", "source_ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transactions_public_id_key" ON "financial_transactions"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transactions_legacy_mongo_id_key" ON "financial_transactions"("legacy_mongo_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transactions_reverses_transaction_id_key" ON "financial_transactions"("reverses_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transactions_idempotency_record_id_key" ON "financial_transactions"("idempotency_record_id");

-- CreateIndex
CREATE INDEX "financial_transactions_financial_space_id_occurred_at_id_idx" ON "financial_transactions"("financial_space_id", "occurred_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "financial_transactions_financial_space_id_type_occurred_at__idx" ON "financial_transactions"("financial_space_id", "type", "occurred_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "financial_transactions_financial_space_id_category_id_occur_idx" ON "financial_transactions"("financial_space_id", "category_id", "occurred_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "financial_transactions_posted_at_id_idx" ON "financial_transactions"("posted_at", "id");

-- CreateIndex
CREATE INDEX "financial_transactions_posting_template_definition_id_idx" ON "financial_transactions"("posting_template_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_expense_details_public_id_key" ON "transaction_expense_details"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_expense_details_legacy_mongo_id_key" ON "transaction_expense_details"("legacy_mongo_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_expense_details_financial_transaction_id_key" ON "transaction_expense_details"("financial_transaction_id");

-- CreateIndex
CREATE INDEX "transaction_expense_details_source_ledger_account_id_idx" ON "transaction_expense_details"("source_ledger_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_income_details_public_id_key" ON "transaction_income_details"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_income_details_legacy_mongo_id_key" ON "transaction_income_details"("legacy_mongo_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_income_details_financial_transaction_id_key" ON "transaction_income_details"("financial_transaction_id");

-- CreateIndex
CREATE INDEX "transaction_income_details_target_ledger_account_id_idx" ON "transaction_income_details"("target_ledger_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_transfer_details_public_id_key" ON "transaction_transfer_details"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_transfer_details_legacy_mongo_id_key" ON "transaction_transfer_details"("legacy_mongo_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_transfer_details_financial_transaction_id_key" ON "transaction_transfer_details"("financial_transaction_id");

-- CreateIndex
CREATE INDEX "transaction_transfer_details_source_ledger_account_id_idx" ON "transaction_transfer_details"("source_ledger_account_id");

-- CreateIndex
CREATE INDEX "transaction_transfer_details_target_ledger_account_id_idx" ON "transaction_transfer_details"("target_ledger_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "interspace_transfer_groups_public_id_key" ON "interspace_transfer_groups"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "interspace_transfer_groups_legacy_mongo_id_key" ON "interspace_transfer_groups"("legacy_mongo_id");

-- CreateIndex
CREATE UNIQUE INDEX "interspace_transfer_groups_source_transaction_id_key" ON "interspace_transfer_groups"("source_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "interspace_transfer_groups_target_transaction_id_key" ON "interspace_transfer_groups"("target_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "interspace_transfer_groups_idempotency_record_id_key" ON "interspace_transfer_groups"("idempotency_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "interspace_transfer_groups_legacy_transaction_mongo_id_key" ON "interspace_transfer_groups"("legacy_transaction_mongo_id");

-- CreateIndex
CREATE INDEX "interspace_transfer_groups_source_financial_space_id_create_idx" ON "interspace_transfer_groups"("source_financial_space_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "interspace_transfer_groups_target_financial_space_id_create_idx" ON "interspace_transfer_groups"("target_financial_space_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "interspace_transfer_groups_actor_user_id_created_at_id_idx" ON "interspace_transfer_groups"("actor_user_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "interspace_transfer_groups_source_ledger_account_id_idx" ON "interspace_transfer_groups"("source_ledger_account_id");

-- CreateIndex
CREATE INDEX "interspace_transfer_groups_target_ledger_account_id_idx" ON "interspace_transfer_groups"("target_ledger_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "debt_agreements_public_id_key" ON "debt_agreements"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "debt_agreements_legacy_mongo_id_key" ON "debt_agreements"("legacy_mongo_id");

-- CreateIndex
CREATE UNIQUE INDEX "debt_agreements_origin_transaction_id_key" ON "debt_agreements"("origin_transaction_id");

-- CreateIndex
CREATE INDEX "debt_agreements_financial_space_id_direction_status_due_at__idx" ON "debt_agreements"("financial_space_id", "direction", "status", "due_at", "id");

-- CreateIndex
CREATE INDEX "debt_agreements_counterparty_contact_id_status_id_idx" ON "debt_agreements"("counterparty_contact_id", "status", "id");

-- CreateIndex
CREATE INDEX "debt_agreements_cash_ledger_account_id_idx" ON "debt_agreements"("cash_ledger_account_id");

-- CreateIndex
CREATE INDEX "debt_agreements_debt_ledger_account_id_idx" ON "debt_agreements"("debt_ledger_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "debt_settlements_public_id_key" ON "debt_settlements"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "debt_settlements_legacy_mongo_id_key" ON "debt_settlements"("legacy_mongo_id");

-- CreateIndex
CREATE UNIQUE INDEX "debt_settlements_financial_transaction_id_key" ON "debt_settlements"("financial_transaction_id");

-- CreateIndex
CREATE INDEX "debt_settlements_debt_agreement_id_occurred_at_id_idx" ON "debt_settlements"("debt_agreement_id", "occurred_at", "id");

-- CreateIndex
CREATE INDEX "debt_settlements_financial_space_id_idx" ON "debt_settlements"("financial_space_id");

-- CreateIndex
CREATE INDEX "debt_settlements_cash_ledger_account_id_idx" ON "debt_settlements"("cash_ledger_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_saving_details_public_id_key" ON "transaction_saving_details"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_saving_details_financial_transaction_id_key" ON "transaction_saving_details"("financial_transaction_id");

-- CreateIndex
CREATE INDEX "transaction_saving_details_saving_account_id_action_id_idx" ON "transaction_saving_details"("saving_account_id", "action", "id");

-- CreateIndex
CREATE INDEX "transaction_saving_details_source_ledger_account_id_idx" ON "transaction_saving_details"("source_ledger_account_id");

-- CreateIndex
CREATE INDEX "transaction_saving_details_target_ledger_account_id_idx" ON "transaction_saving_details"("target_ledger_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_saving_details_saving_period_id_action_key" ON "transaction_saving_details"("saving_period_id", "action");

-- CreateIndex
CREATE UNIQUE INDEX "migration_anchor_details_public_id_key" ON "migration_anchor_details"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "migration_anchor_details_financial_transaction_id_key" ON "migration_anchor_details"("financial_transaction_id");

-- CreateIndex
CREATE INDEX "migration_anchor_details_ledger_account_id_idx" ON "migration_anchor_details"("ledger_account_id");

-- CreateIndex
CREATE INDEX "migration_anchor_details_migration_run_id_idx" ON "migration_anchor_details"("migration_run_id");

-- CreateIndex
CREATE INDEX "migration_anchor_details_discrepancy_case_id_idx" ON "migration_anchor_details"("discrepancy_case_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_public_id_key" ON "notifications"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_legacy_mongo_id_key" ON "notifications"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "notifications_financial_space_id_created_at_id_idx" ON "notifications"("financial_space_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "notifications_source_outbox_event_id_idx" ON "notifications"("source_outbox_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_notifications_public_id_key" ON "user_notifications"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_notifications_legacy_mongo_id_key" ON "user_notifications"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "user_notifications_user_id_is_read_received_at_id_idx" ON "user_notifications"("user_id", "is_read", "received_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "user_notifications_notification_id_idx" ON "user_notifications"("notification_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_notifications_user_id_notification_id_key" ON "user_notifications"("user_id", "notification_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_account_definitions_public_id_key" ON "system_account_definitions"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_account_definitions_code_key" ON "system_account_definitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "posting_template_definitions_public_id_key" ON "posting_template_definitions"("public_id");

-- CreateIndex
CREATE INDEX "posting_template_definitions_status_effective_at_idx" ON "posting_template_definitions"("status", "effective_at");

-- CreateIndex
CREATE UNIQUE INDEX "posting_template_definitions_code_version_key" ON "posting_template_definitions"("code", "version");

-- CreateIndex
CREATE INDEX "posting_template_entry_roles_required_system_role_idx" ON "posting_template_entry_roles"("required_system_role");

-- CreateIndex
CREATE UNIQUE INDEX "posting_template_entry_roles_posting_template_definition_id_key" ON "posting_template_entry_roles"("posting_template_definition_id", "entry_role");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_public_id_key" ON "ledger_accounts"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_account_id_key" ON "ledger_accounts"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_accumulation_id_key" ON "ledger_accounts"("accumulation_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_saving_account_id_key" ON "ledger_accounts"("saving_account_id");

-- CreateIndex
CREATE INDEX "ledger_accounts_financial_space_id_status_id_idx" ON "ledger_accounts"("financial_space_id", "status", "id");

-- CreateIndex
CREATE INDEX "ledger_accounts_financial_space_id_kind_system_role_idx" ON "ledger_accounts"("financial_space_id", "kind", "system_role");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_financial_space_id_system_role_key" ON "ledger_accounts"("financial_space_id", "system_role");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_public_id_key" ON "ledger_entries"("public_id");

-- CreateIndex
CREATE INDEX "ledger_entries_financial_transaction_id_id_idx" ON "ledger_entries"("financial_transaction_id", "id");

-- CreateIndex
CREATE INDEX "ledger_entries_ledger_account_id_posted_at_account_sequence_idx" ON "ledger_entries"("ledger_account_id", "posted_at", "account_sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_ledger_account_id_account_sequence_key" ON "ledger_entries"("ledger_account_id", "account_sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_financial_transaction_id_ledger_account_id_e_key" ON "ledger_entries"("financial_transaction_id", "ledger_account_id", "entry_role");

-- CreateIndex
CREATE UNIQUE INDEX "balance_snapshot_runs_public_id_key" ON "balance_snapshot_runs"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "balance_snapshot_runs_idempotency_key_key" ON "balance_snapshot_runs"("idempotency_key");

-- CreateIndex
CREATE INDEX "balance_snapshot_runs_status_business_date_id_idx" ON "balance_snapshot_runs"("status", "business_date", "id");

-- CreateIndex
CREATE UNIQUE INDEX "balance_snapshot_runs_financial_space_id_business_date_calc_key" ON "balance_snapshot_runs"("financial_space_id", "business_date", "calculation_version", "trigger_type");

-- CreateIndex
CREATE UNIQUE INDEX "account_balance_snapshots_public_id_key" ON "account_balance_snapshots"("public_id");

-- CreateIndex
CREATE INDEX "account_balance_snapshots_financial_space_id_business_date_idx" ON "account_balance_snapshots"("financial_space_id", "business_date");

-- CreateIndex
CREATE INDEX "account_balance_snapshots_status_business_date_idx" ON "account_balance_snapshots"("status", "business_date");

-- CreateIndex
CREATE INDEX "account_balance_snapshots_snapshot_run_id_idx" ON "account_balance_snapshots"("snapshot_run_id");

-- CreateIndex
CREATE INDEX "account_balance_snapshots_superseded_by_id_idx" ON "account_balance_snapshots"("superseded_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_balance_snapshots_ledger_account_id_business_date_c_key" ON "account_balance_snapshots"("ledger_account_id", "business_date", "calculation_version");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_public_id_key" ON "idempotency_records"("public_id");

-- CreateIndex
CREATE INDEX "idempotency_records_status_lease_expires_at_id_idx" ON "idempotency_records"("status", "lease_expires_at", "id");

-- CreateIndex
CREATE INDEX "idempotency_records_resource_type_resource_public_id_idx" ON "idempotency_records"("resource_type", "resource_public_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_financial_space_id_actor_type_actor_id__key" ON "idempotency_records"("financial_space_id", "actor_type", "actor_id", "operation", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_public_id_key" ON "outbox_events"("public_id");

-- CreateIndex
CREATE INDEX "outbox_events_status_next_attempt_at_id_idx" ON "outbox_events"("status", "next_attempt_at", "id");

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_type_aggregate_public_id_aggregate__idx" ON "outbox_events"("aggregate_type", "aggregate_public_id", "aggregate_sequence");

-- CreateIndex
CREATE INDEX "outbox_events_lease_expires_at_idx" ON "outbox_events"("lease_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_aggregate_type_aggregate_public_id_aggregate__key" ON "outbox_events"("aggregate_type", "aggregate_public_id", "aggregate_sequence");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_delivery_attempts_public_id_key" ON "outbox_delivery_attempts"("public_id");

-- CreateIndex
CREATE INDEX "outbox_delivery_attempts_status_started_at_idx" ON "outbox_delivery_attempts"("status", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_delivery_attempts_outbox_event_id_attempt_number_key" ON "outbox_delivery_attempts"("outbox_event_id", "attempt_number");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_delivery_attempts_provider_provider_idempotency_key__key" ON "outbox_delivery_attempts"("provider", "provider_idempotency_key", "attempt_number");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_receipts_public_id_key" ON "inbox_receipts"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_receipts_consumer_event_public_id_key" ON "inbox_receipts"("consumer", "event_public_id");

-- CreateIndex
CREATE UNIQUE INDEX "temporary_assets_public_id_key" ON "temporary_assets"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "temporary_assets_legacy_mongo_id_key" ON "temporary_assets"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "temporary_assets_status_expires_at_id_idx" ON "temporary_assets"("status", "expires_at", "id");

-- CreateIndex
CREATE INDEX "temporary_assets_financial_space_id_status_id_idx" ON "temporary_assets"("financial_space_id", "status", "id");

-- CreateIndex
CREATE UNIQUE INDEX "temporary_assets_provider_provider_public_id_key" ON "temporary_assets"("provider", "provider_public_id");

-- CreateIndex
CREATE UNIQUE INDEX "temporary_assets_owner_user_id_upload_session_id_checksum_s_key" ON "temporary_assets"("owner_user_id", "upload_session_id", "checksum_sha256");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_public_id_key" ON "attachments"("public_id");

-- CreateIndex
CREATE INDEX "attachments_asset_id_status_idx" ON "attachments"("asset_id", "status");

-- CreateIndex
CREATE INDEX "attachments_financial_space_id_financial_transaction_id_idx" ON "attachments"("financial_space_id", "financial_transaction_id");

-- CreateIndex
CREATE INDEX "attachments_status_created_at_idx" ON "attachments"("status", "created_at");

-- CreateIndex
CREATE INDEX "attachments_user_avatar_user_id_idx" ON "attachments"("user_avatar_user_id");

-- CreateIndex
CREATE INDEX "attachments_space_background_space_id_idx" ON "attachments"("space_background_space_id");

-- CreateIndex
CREATE INDEX "attachments_bank_logo_bank_id_idx" ON "attachments"("bank_logo_bank_id");

-- CreateIndex
CREATE UNIQUE INDEX "migration_runs_public_id_key" ON "migration_runs"("public_id");

-- CreateIndex
CREATE INDEX "migration_runs_status_created_at_idx" ON "migration_runs"("status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "migration_runs_source_snapshot_id_source_checksum_mapping_v_key" ON "migration_runs"("source_snapshot_id", "source_checksum", "mapping_version", "schema_version", "run_type");

-- CreateIndex
CREATE INDEX "migration_source_records_migration_run_id_source_collection_idx" ON "migration_source_records"("migration_run_id", "source_collection", "disposition", "id");

-- CreateIndex
CREATE INDEX "migration_source_records_target_type_target_public_id_idx" ON "migration_source_records"("target_type", "target_public_id");

-- CreateIndex
CREATE UNIQUE INDEX "migration_source_records_migration_run_id_source_collection_key" ON "migration_source_records"("migration_run_id", "source_collection", "source_legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "migration_checkpoints_public_id_key" ON "migration_checkpoints"("public_id");

-- CreateIndex
CREATE INDEX "migration_checkpoints_migration_run_id_status_graph_level_idx" ON "migration_checkpoints"("migration_run_id", "status", "graph_level");

-- CreateIndex
CREATE UNIQUE INDEX "migration_checkpoints_migration_run_id_graph_level_source_c_key" ON "migration_checkpoints"("migration_run_id", "graph_level", "source_collection");

-- CreateIndex
CREATE UNIQUE INDEX "discrepancy_cases_public_id_key" ON "discrepancy_cases"("public_id");

-- CreateIndex
CREATE INDEX "discrepancy_cases_status_severity_detected_at_id_idx" ON "discrepancy_cases"("status", "severity", "detected_at", "id");

-- CreateIndex
CREATE INDEX "discrepancy_cases_source_type_status_idx" ON "discrepancy_cases"("source", "type", "status");

-- CreateIndex
CREATE INDEX "discrepancy_cases_resource_type_resource_public_id_idx" ON "discrepancy_cases"("resource_type", "resource_public_id");

-- CreateIndex
CREATE INDEX "discrepancy_cases_migration_run_id_idx" ON "discrepancy_cases"("migration_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_events_public_id_key" ON "audit_events"("public_id");

-- CreateIndex
CREATE INDEX "audit_events_resource_type_resource_public_id_occurred_at_i_idx" ON "audit_events"("resource_type", "resource_public_id", "occurred_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "audit_events_financial_space_id_occurred_at_idx" ON "audit_events"("financial_space_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_events_actor_public_id_occurred_at_idx" ON "audit_events"("actor_public_id", "occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "feature_flag_overrides_public_id_key" ON "feature_flag_overrides"("public_id");

-- CreateIndex
CREATE INDEX "feature_flag_overrides_deployment_environment_effective_at__idx" ON "feature_flag_overrides"("deployment_environment", "effective_at", "expires_at");

-- Wave 2 constraints that Prisma schema syntax cannot express.
ALTER TABLE "users" ADD CONSTRAINT "users_currency_code_check" CHECK ("currency_code" = 'VND');
ALTER TABLE "users" ADD CONSTRAINT "users_month_start_day_check" CHECK ("month_start_day" BETWEEN 1 AND 31);
ALTER TABLE "users" ADD CONSTRAINT "users_auth_version_check" CHECK ("auth_version" >= 2);
ALTER TABLE "users" ADD CONSTRAINT "users_deleted_status_check" CHECK ("deleted_at" IS NULL OR "status" = 'DELETED');
ALTER TABLE "token_families" ADD CONSTRAINT "token_families_revocation_check" CHECK (("status" IN ('REVOKED', 'COMPROMISED')) = ("revoked_at" IS NOT NULL));
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_rotation_check" CHECK (("status" = 'ROTATED') = ("replaced_by_session_id" IS NOT NULL));
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_revocation_check" CHECK ("status" <> 'REVOKED' OR ("revoked_at" IS NOT NULL AND "revoked_reason" IS NOT NULL));
ALTER TABLE "financial_space_memberships" ADD CONSTRAINT "memberships_end_check" CHECK (("status" = 'LEFT') = ("ended_at" IS NOT NULL));
ALTER TABLE "category_edges" ADD CONSTRAINT "category_edges_distinct_check" CHECK ("parent_category_id" <> "child_category_id");
ALTER TABLE "accumulations" ADD CONSTRAINT "accumulations_amount_check" CHECK ("target_amount" >= 0 AND "legacy_stored_balance" >= 0);
ALTER TABLE "accumulations" ADD CONSTRAINT "accumulations_period_check" CHECK ("ends_at" >= "starts_at");
ALTER TABLE "savings_accounts" ADD CONSTRAINT "savings_amount_check" CHECK ("principal_amount" >= 0 AND "legacy_stored_balance" >= 0);
ALTER TABLE "savings_accounts" ADD CONSTRAINT "savings_rate_check" CHECK ("annual_rate" BETWEEN 0 AND 100 AND "non_term_annual_rate" BETWEEN 0 AND 100);
ALTER TABLE "savings_accounts" ADD CONSTRAINT "savings_term_check" CHECK ("term_months" >= 1);
ALTER TABLE "savings_accounts" ADD CONSTRAINT "savings_parent_check" CHECK ("parent_saving_id" IS NULL OR "parent_saving_id" <> "id");
ALTER TABLE "saving_periods" ADD CONSTRAINT "saving_periods_ordinal_check" CHECK ("period_ordinal" >= 1);
ALTER TABLE "saving_periods" ADD CONSTRAINT "saving_periods_completion_check" CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL));
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_period_check" CHECK ("ends_at" >= "starts_at");
ALTER TABLE "budget_allocations" ADD CONSTRAINT "budget_allocations_amount_check" CHECK ("amount" >= 0 AND "source_ordinal" >= 0);
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_snapshot_version_check" CHECK ("snapshot_schema_version" >= 1);
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_amount_check" CHECK (
  ("type" = 'ACCOUNT_OPENING') OR
  ("type" = 'ACCUMULATION_OPENING' AND "amount" = 0) OR
  ("type" NOT IN ('ACCOUNT_OPENING', 'ACCUMULATION_OPENING') AND "amount" > 0)
);
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_posted_at_check" CHECK (("status" = 'DRAFT') = ("posted_at" IS NULL));
ALTER TABLE "transaction_transfer_details" ADD CONSTRAINT "transaction_transfer_details_accounts_check" CHECK ("source_ledger_account_id" <> "target_ledger_account_id");
ALTER TABLE "transaction_transfer_details" ADD CONSTRAINT "transaction_transfer_details_fee_check" CHECK ("fee_amount" IS NULL OR "fee_amount" >= 0);
ALTER TABLE "interspace_transfer_groups" ADD CONSTRAINT "interspace_transfer_groups_space_check" CHECK ("source_financial_space_id" <> "target_financial_space_id");
ALTER TABLE "interspace_transfer_groups" ADD CONSTRAINT "interspace_transfer_groups_amount_check" CHECK ("amount" > 0);
ALTER TABLE "debt_agreements" ADD CONSTRAINT "debt_agreements_principal_check" CHECK ("principal_amount" > 0 AND "outstanding_principal" BETWEEN 0 AND "principal_amount" AND "outstanding_interest" >= 0);
ALTER TABLE "debt_agreements" ADD CONSTRAINT "debt_agreements_rate_check" CHECK (
  ("rate_basis" IN ('ANNUAL_PERCENT', 'MONTHLY_PERCENT') AND "rate_value" BETWEEN 0 AND 100 AND "fixed_interest_amount" IS NULL) OR
  ("rate_basis" = 'FIXED_AMOUNT' AND "rate_value" IS NULL AND "fixed_interest_amount" >= 0) OR
  ("rate_basis" = 'UNSPECIFIED' AND "fixed_interest_amount" IS NULL)
);
ALTER TABLE "debt_agreements" ADD CONSTRAINT "debt_agreements_settlement_check" CHECK (("status" = 'SETTLED') = ("settled_at" IS NOT NULL));
ALTER TABLE "debt_settlements" ADD CONSTRAINT "debt_settlements_amount_check" CHECK ("principal_amount" >= 0 AND "interest_amount" >= 0 AND "principal_amount" + "interest_amount" > 0);
ALTER TABLE "transaction_saving_details" ADD CONSTRAINT "transaction_saving_details_amount_check" CHECK ("principal_amount" >= 0 AND "interest_amount" >= 0 AND "calculation_version" >= 1);
ALTER TABLE "migration_anchor_details" ADD CONSTRAINT "migration_anchor_difference_check" CHECK ("difference_amount" = "source_legacy_balance" - "reconstructed_balance" AND "difference_amount" <> 0);
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_read_check" CHECK (("is_read" AND "read_at" IS NOT NULL) OR (NOT "is_read" AND "read_at" IS NULL));
ALTER TABLE "posting_template_definitions" ADD CONSTRAINT "posting_template_definitions_version_check" CHECK ("version" >= 1);
ALTER TABLE "posting_template_definitions" ADD CONSTRAINT "posting_template_definitions_retired_check" CHECK (("status" = 'RETIRED') = ("retired_at" IS NOT NULL));
ALTER TABLE "posting_template_entry_roles" ADD CONSTRAINT "posting_template_entry_roles_occurrence_check" CHECK ("minimum_occurrences" >= 0 AND "maximum_occurrences" >= "minimum_occurrences");
ALTER TABLE "posting_template_entry_roles" ADD CONSTRAINT "posting_template_entry_roles_system_check" CHECK (("required_account_kind" = 'SYSTEM') = ("required_system_role" IS NOT NULL));
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_sequence_check" CHECK ("current_sequence" >= 0);
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_owner_check" CHECK (
  ("kind" = 'USER_BALANCE' AND "system_role" IS NULL AND num_nonnulls("account_id", "accumulation_id", "saving_account_id") = 1) OR
  ("kind" = 'SYSTEM' AND "system_role" IS NOT NULL AND num_nonnulls("account_id", "accumulation_id", "saving_account_id") = 0)
);
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_sequence_check" CHECK ("account_sequence" > 0);
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_amount_check" CHECK ("amount" <> 0 AND "balance_after" = "balance_before" + "amount");
ALTER TABLE "balance_snapshot_runs" ADD CONSTRAINT "balance_snapshot_runs_version_check" CHECK ("calculation_version" >= 1);
ALTER TABLE "balance_snapshot_runs" ADD CONSTRAINT "balance_snapshot_runs_counts_check" CHECK ("accounts_total" >= 0 AND "accounts_succeeded" >= 0 AND "accounts_failed" >= 0 AND "accounts_succeeded" + "accounts_failed" <= "accounts_total");
ALTER TABLE "account_balance_snapshots" ADD CONSTRAINT "account_balance_snapshots_period_check" CHECK ("period_end_utc" = "period_start_utc" + INTERVAL '1 day');
ALTER TABLE "account_balance_snapshots" ADD CONSTRAINT "account_balance_snapshots_balance_check" CHECK ("total_inflow" >= 0 AND "total_outflow" >= 0 AND "closing_balance" = "opening_balance" + "total_inflow" - "total_outflow");
ALTER TABLE "account_balance_snapshots" ADD CONSTRAINT "account_balance_snapshots_sequence_check" CHECK ("cutoff_sequence" >= 0 AND "entry_count" >= 0 AND "calculation_version" >= 1 AND (("first_entry_sequence" IS NULL AND "last_entry_sequence" IS NULL AND "entry_count" = 0) OR ("first_entry_sequence" IS NOT NULL AND "last_entry_sequence" >= "first_entry_sequence" AND "entry_count" > 0)));
ALTER TABLE "account_balance_snapshots" ADD CONSTRAINT "account_balance_snapshots_supersession_check" CHECK (("status" = 'SUPERSEDED') = ("superseded_by_id" IS NOT NULL AND "superseded_at" IS NOT NULL));
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_terminal_check" CHECK (("status" = 'IN_PROGRESS' AND "completed_at" IS NULL) OR ("status" <> 'IN_PROGRESS' AND "completed_at" IS NOT NULL));
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_sequence_check" CHECK ("aggregate_sequence" > 0 AND "event_schema_version" >= 1 AND "attempt_count" >= 0);
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_delivery_check" CHECK (("status" = 'DELIVERED') = ("delivered_at" IS NOT NULL));
ALTER TABLE "outbox_delivery_attempts" ADD CONSTRAINT "outbox_delivery_attempts_number_check" CHECK ("attempt_number" > 0);
ALTER TABLE "outbox_delivery_attempts" ADD CONSTRAINT "outbox_delivery_attempts_finish_check" CHECK (("status" = 'STARTED' AND "finished_at" IS NULL) OR ("status" <> 'STARTED' AND "finished_at" IS NOT NULL));
ALTER TABLE "inbox_receipts" ADD CONSTRAINT "inbox_receipts_version_check" CHECK ("event_schema_version" >= 1);
ALTER TABLE "temporary_assets" ADD CONSTRAINT "temporary_assets_size_check" CHECK ("size_bytes" IS NULL OR "size_bytes" >= 0);
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_owner_check" CHECK (num_nonnulls("user_avatar_user_id", "space_background_space_id", "bank_logo_bank_id", "financial_transaction_id") = 1);
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_ordinal_check" CHECK ("source_ordinal" >= 0);
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_status_time_check" CHECK (("status" = 'ACTIVE') = ("activated_at" IS NOT NULL) AND (("status" IN ('REPLACED', 'REMOVED')) = ("removed_at" IS NOT NULL)));
ALTER TABLE "migration_runs" ADD CONSTRAINT "migration_runs_counts_check" CHECK ("source_count" >= 0 AND "loaded_count" >= 0 AND "rejected_count" >= 0 AND "loaded_count" + "rejected_count" <= "source_count");
ALTER TABLE "migration_checkpoints" ADD CONSTRAINT "migration_checkpoints_level_check" CHECK ("graph_level" BETWEEN 0 AND 20);
ALTER TABLE "migration_checkpoints" ADD CONSTRAINT "migration_checkpoints_counts_check" CHECK ("processed_count" >= 0 AND "loaded_count" >= 0 AND "rejected_count" >= 0 AND "loaded_count" + "rejected_count" <= "processed_count");
ALTER TABLE "discrepancy_cases" ADD CONSTRAINT "discrepancy_cases_counter_check" CHECK ("version" >= 1 AND "recurrence_count" >= 1);
ALTER TABLE "discrepancy_cases" ADD CONSTRAINT "discrepancy_cases_resolution_check" CHECK (("status" IN ('RESOLVED', 'IGNORED')) = ("resolved_at" IS NOT NULL AND "resolved_by_user_id" IS NOT NULL AND "resolution_note" IS NOT NULL));
ALTER TABLE "discrepancy_cases" ADD CONSTRAINT "discrepancy_cases_blocking_check" CHECK (NOT ("severity" = 'BLOCKING' AND "status" = 'IGNORED'));
ALTER TABLE "feature_flag_overrides" ADD CONSTRAINT "feature_flag_overrides_version_check" CHECK ("version" >= 1);
ALTER TABLE "feature_flag_overrides" ADD CONSTRAINT "feature_flag_overrides_expiry_check" CHECK ("expires_at" IS NULL OR "expires_at" > "effective_at");

-- Authoritative FK/delete policies.
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_attachment_id_fkey" FOREIGN KEY ("avatar_attachment_id") REFERENCES "attachments"("id") ON DELETE SET NULL;
ALTER TABLE "token_families" ADD CONSTRAINT "token_families_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_token_family_id_fkey" FOREIGN KEY ("token_family_id") REFERENCES "token_families"("id") ON DELETE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_replaced_by_session_id_fkey" FOREIGN KEY ("replaced_by_session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT;
ALTER TABLE "financial_spaces" ADD CONSTRAINT "financial_spaces_background_attachment_id_fkey" FOREIGN KEY ("background_attachment_id") REFERENCES "attachments"("id") ON DELETE SET NULL;
ALTER TABLE "financial_space_memberships" ADD CONSTRAINT "memberships_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "financial_space_memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "categories" ADD CONSTRAINT "categories_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "category_edges" ADD CONSTRAINT "category_edges_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "category_edges" ADD CONSTRAINT "category_edges_parent_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "categories"("id") ON DELETE RESTRICT;
ALTER TABLE "category_edges" ADD CONSTRAINT "category_edges_child_id_fkey" FOREIGN KEY ("child_category_id") REFERENCES "categories"("id") ON DELETE RESTRICT;
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "banks"("id") ON DELETE RESTRICT;
ALTER TABLE "accumulations" ADD CONSTRAINT "accumulations_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "savings_accounts" ADD CONSTRAINT "savings_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "savings_accounts" ADD CONSTRAINT "savings_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "banks"("id") ON DELETE RESTRICT;
ALTER TABLE "savings_accounts" ADD CONSTRAINT "savings_funding_ledger_id_fkey" FOREIGN KEY ("funding_ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "savings_accounts" ADD CONSTRAINT "savings_interest_ledger_id_fkey" FOREIGN KEY ("interest_target_ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "savings_accounts" ADD CONSTRAINT "savings_parent_id_fkey" FOREIGN KEY ("parent_saving_id") REFERENCES "savings_accounts"("id") ON DELETE RESTRICT;
ALTER TABLE "saving_periods" ADD CONSTRAINT "saving_periods_saving_id_fkey" FOREIGN KEY ("saving_account_id") REFERENCES "savings_accounts"("id") ON DELETE RESTRICT;
ALTER TABLE "saving_periods" ADD CONSTRAINT "saving_periods_transaction_id_fkey" FOREIGN KEY ("financial_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "budget_allocations" ADD CONSTRAINT "budget_allocations_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE RESTRICT;
ALTER TABLE "budget_allocations" ADD CONSTRAINT "budget_allocations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_template_id_fkey" FOREIGN KEY ("posting_template_definition_id") REFERENCES "posting_template_definitions"("id") ON DELETE RESTRICT;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_reversal_id_fkey" FOREIGN KEY ("reverses_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT;
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_idempotency_id_fkey" FOREIGN KEY ("idempotency_record_id") REFERENCES "idempotency_records"("id") ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "transaction_expense_details" ADD CONSTRAINT "expense_details_transaction_id_fkey" FOREIGN KEY ("financial_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT;
ALTER TABLE "transaction_expense_details" ADD CONSTRAINT "expense_details_ledger_id_fkey" FOREIGN KEY ("source_ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT;
ALTER TABLE "transaction_income_details" ADD CONSTRAINT "income_details_transaction_id_fkey" FOREIGN KEY ("financial_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT;
ALTER TABLE "transaction_income_details" ADD CONSTRAINT "income_details_ledger_id_fkey" FOREIGN KEY ("target_ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT;
ALTER TABLE "transaction_transfer_details" ADD CONSTRAINT "transfer_details_transaction_id_fkey" FOREIGN KEY ("financial_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT;
ALTER TABLE "transaction_transfer_details" ADD CONSTRAINT "transfer_details_source_ledger_id_fkey" FOREIGN KEY ("source_ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT;
ALTER TABLE "transaction_transfer_details" ADD CONSTRAINT "transfer_details_target_ledger_id_fkey" FOREIGN KEY ("target_ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT;
ALTER TABLE "interspace_transfer_groups" ADD CONSTRAINT "interspace_source_space_id_fkey" FOREIGN KEY ("source_financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "interspace_transfer_groups" ADD CONSTRAINT "interspace_target_space_id_fkey" FOREIGN KEY ("target_financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "interspace_transfer_groups" ADD CONSTRAINT "interspace_actor_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "interspace_transfer_groups" ADD CONSTRAINT "interspace_source_ledger_id_fkey" FOREIGN KEY ("source_ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT;
ALTER TABLE "interspace_transfer_groups" ADD CONSTRAINT "interspace_target_ledger_id_fkey" FOREIGN KEY ("target_ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT;
ALTER TABLE "interspace_transfer_groups" ADD CONSTRAINT "interspace_source_transaction_id_fkey" FOREIGN KEY ("source_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT;
ALTER TABLE "interspace_transfer_groups" ADD CONSTRAINT "interspace_target_transaction_id_fkey" FOREIGN KEY ("target_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT;
ALTER TABLE "interspace_transfer_groups" ADD CONSTRAINT "interspace_idempotency_id_fkey" FOREIGN KEY ("idempotency_record_id") REFERENCES "idempotency_records"("id") ON DELETE RESTRICT;
ALTER TABLE "debt_agreements" ADD CONSTRAINT "debt_agreements_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "debt_agreements" ADD CONSTRAINT "debt_agreements_origin_id_fkey" FOREIGN KEY ("origin_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT;
ALTER TABLE "debt_agreements" ADD CONSTRAINT "debt_agreements_cash_ledger_id_fkey" FOREIGN KEY ("cash_ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT;
ALTER TABLE "debt_agreements" ADD CONSTRAINT "debt_agreements_debt_ledger_id_fkey" FOREIGN KEY ("debt_ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT;
ALTER TABLE "debt_agreements" ADD CONSTRAINT "debt_agreements_contact_id_fkey" FOREIGN KEY ("counterparty_contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT;
ALTER TABLE "debt_settlements" ADD CONSTRAINT "debt_settlements_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "debt_settlements" ADD CONSTRAINT "debt_settlements_transaction_id_fkey" FOREIGN KEY ("financial_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT;
ALTER TABLE "debt_settlements" ADD CONSTRAINT "debt_settlements_debt_id_fkey" FOREIGN KEY ("debt_agreement_id") REFERENCES "debt_agreements"("id") ON DELETE RESTRICT;
ALTER TABLE "debt_settlements" ADD CONSTRAINT "debt_settlements_cash_ledger_id_fkey" FOREIGN KEY ("cash_ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT;
ALTER TABLE "transaction_saving_details" ADD CONSTRAINT "saving_details_transaction_id_fkey" FOREIGN KEY ("financial_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT;
ALTER TABLE "transaction_saving_details" ADD CONSTRAINT "saving_details_saving_id_fkey" FOREIGN KEY ("saving_account_id") REFERENCES "savings_accounts"("id") ON DELETE RESTRICT;
ALTER TABLE "transaction_saving_details" ADD CONSTRAINT "saving_details_period_id_fkey" FOREIGN KEY ("saving_period_id") REFERENCES "saving_periods"("id") ON DELETE RESTRICT;
ALTER TABLE "transaction_saving_details" ADD CONSTRAINT "saving_details_source_ledger_id_fkey" FOREIGN KEY ("source_ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT;
ALTER TABLE "transaction_saving_details" ADD CONSTRAINT "saving_details_target_ledger_id_fkey" FOREIGN KEY ("target_ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT;
ALTER TABLE "migration_anchor_details" ADD CONSTRAINT "migration_anchor_transaction_id_fkey" FOREIGN KEY ("financial_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT;
ALTER TABLE "migration_anchor_details" ADD CONSTRAINT "migration_anchor_ledger_id_fkey" FOREIGN KEY ("ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT;
ALTER TABLE "migration_anchor_details" ADD CONSTRAINT "migration_anchor_run_id_fkey" FOREIGN KEY ("migration_run_id") REFERENCES "migration_runs"("id") ON DELETE RESTRICT;
ALTER TABLE "migration_anchor_details" ADD CONSTRAINT "migration_anchor_discrepancy_id_fkey" FOREIGN KEY ("discrepancy_case_id") REFERENCES "discrepancy_cases"("id") ON DELETE RESTRICT;
ALTER TABLE "migration_anchor_details" ADD CONSTRAINT "migration_anchor_approver_id_fkey" FOREIGN KEY ("approval_actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_outbox_id_fkey" FOREIGN KEY ("source_outbox_event_id") REFERENCES "outbox_events"("id") ON DELETE RESTRICT;
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE RESTRICT;
ALTER TABLE "posting_template_entry_roles" ADD CONSTRAINT "template_entry_roles_definition_id_fkey" FOREIGN KEY ("posting_template_definition_id") REFERENCES "posting_template_definitions"("id") ON DELETE RESTRICT;
ALTER TABLE "posting_template_entry_roles" ADD CONSTRAINT "template_entry_roles_system_role_fkey" FOREIGN KEY ("required_system_role") REFERENCES "system_account_definitions"("code") ON DELETE RESTRICT;
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_system_role_fkey" FOREIGN KEY ("system_role") REFERENCES "system_account_definitions"("code") ON DELETE RESTRICT;
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT;
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_accumulation_id_fkey" FOREIGN KEY ("accumulation_id") REFERENCES "accumulations"("id") ON DELETE RESTRICT;
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_saving_id_fkey" FOREIGN KEY ("saving_account_id") REFERENCES "savings_accounts"("id") ON DELETE RESTRICT;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("financial_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_fkey" FOREIGN KEY ("ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT;
ALTER TABLE "balance_snapshot_runs" ADD CONSTRAINT "snapshot_runs_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "account_balance_snapshots" ADD CONSTRAINT "balance_snapshots_run_id_fkey" FOREIGN KEY ("snapshot_run_id") REFERENCES "balance_snapshot_runs"("id") ON DELETE RESTRICT;
ALTER TABLE "account_balance_snapshots" ADD CONSTRAINT "balance_snapshots_ledger_id_fkey" FOREIGN KEY ("ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT;
ALTER TABLE "account_balance_snapshots" ADD CONSTRAINT "balance_snapshots_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "account_balance_snapshots" ADD CONSTRAINT "balance_snapshots_superseded_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "account_balance_snapshots"("id") ON DELETE RESTRICT;
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "outbox_delivery_attempts" ADD CONSTRAINT "outbox_attempts_event_id_fkey" FOREIGN KEY ("outbox_event_id") REFERENCES "outbox_events"("id") ON DELETE RESTRICT;
ALTER TABLE "temporary_assets" ADD CONSTRAINT "temporary_assets_owner_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "temporary_assets" ADD CONSTRAINT "temporary_assets_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "temporary_assets"("id") ON DELETE RESTRICT;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_avatar_user_id_fkey" FOREIGN KEY ("user_avatar_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_background_space_id_fkey" FOREIGN KEY ("space_background_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_bank_logo_id_fkey" FOREIGN KEY ("bank_logo_bank_id") REFERENCES "banks"("id") ON DELETE RESTRICT;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_transaction_id_fkey" FOREIGN KEY ("financial_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_linked_by_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_finalize_outbox_id_fkey" FOREIGN KEY ("finalize_outbox_event_id") REFERENCES "outbox_events"("id") ON DELETE RESTRICT;
ALTER TABLE "migration_source_records" ADD CONSTRAINT "migration_source_records_run_id_fkey" FOREIGN KEY ("migration_run_id") REFERENCES "migration_runs"("id") ON DELETE RESTRICT;
ALTER TABLE "migration_checkpoints" ADD CONSTRAINT "migration_checkpoints_run_id_fkey" FOREIGN KEY ("migration_run_id") REFERENCES "migration_runs"("id") ON DELETE RESTRICT;
ALTER TABLE "discrepancy_cases" ADD CONSTRAINT "discrepancy_cases_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "discrepancy_cases" ADD CONSTRAINT "discrepancy_cases_run_id_fkey" FOREIGN KEY ("migration_run_id") REFERENCES "migration_runs"("id") ON DELETE RESTRICT;
ALTER TABLE "discrepancy_cases" ADD CONSTRAINT "discrepancy_cases_assignee_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "discrepancy_cases" ADD CONSTRAINT "discrepancy_cases_resolver_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE RESTRICT;
ALTER TABLE "feature_flag_overrides" ADD CONSTRAINT "feature_flag_overrides_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;

-- Partial uniqueness and worker indexes.
CREATE UNIQUE INDEX "posting_template_definitions_current_approved_key" ON "posting_template_definitions"("code") WHERE "status" = 'APPROVED';
CREATE UNIQUE INDEX "account_balance_snapshots_current_key" ON "account_balance_snapshots"("ledger_account_id", "business_date") WHERE "is_current";
CREATE INDEX "outbox_events_processing_lease_idx" ON "outbox_events"("lease_expires_at") WHERE "status" = 'PROCESSING';
CREATE UNIQUE INDEX "temporary_assets_provider_identity_key" ON "temporary_assets"("provider", "provider_public_id") WHERE "provider_public_id" IS NOT NULL;
CREATE UNIQUE INDEX "temporary_assets_upload_checksum_key" ON "temporary_assets"("owner_user_id", "upload_session_id", "checksum_sha256") WHERE "checksum_sha256" IS NOT NULL;
DROP INDEX "temporary_assets_provider_provider_public_id_key";
DROP INDEX "temporary_assets_owner_user_id_upload_session_id_checksum_s_key";
CREATE UNIQUE INDEX "attachments_active_transaction_role_key" ON "attachments"("financial_transaction_id", "role", "source_ordinal") WHERE "status" = 'ACTIVE' AND "financial_transaction_id" IS NOT NULL;
CREATE UNIQUE INDEX "attachments_active_avatar_key" ON "attachments"("user_avatar_user_id") WHERE "status" = 'ACTIVE' AND "user_avatar_user_id" IS NOT NULL;
CREATE UNIQUE INDEX "attachments_active_background_key" ON "attachments"("space_background_space_id") WHERE "status" = 'ACTIVE' AND "space_background_space_id" IS NOT NULL;
CREATE UNIQUE INDEX "attachments_active_bank_logo_key" ON "attachments"("bank_logo_bank_id") WHERE "status" = 'ACTIVE' AND "bank_logo_bank_id" IS NOT NULL;
CREATE UNIQUE INDEX "discrepancy_cases_active_fingerprint_key" ON "discrepancy_cases"("fingerprint") WHERE "status" IN ('OPEN', 'INVESTIGATING');
CREATE UNIQUE INDEX "feature_flag_overrides_active_key" ON "feature_flag_overrides"("deployment_environment", "flag_key") WHERE "expires_at" IS NULL;

-- Public never receives schema or table authority implicitly.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;

-- Cross-table ownership and lifecycle guards.
CREATE FUNCTION "v2_validate_session_owner"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "token_families" f WHERE f."id" = NEW."token_family_id" AND f."user_id" = NEW."user_id") THEN
    RAISE EXCEPTION 'SESSION_TOKEN_FAMILY_USER_MISMATCH' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "sessions_owner_guard" AFTER INSERT OR UPDATE ON "sessions"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "v2_validate_session_owner"();

CREATE FUNCTION "v2_validate_category_edge"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "categories" p JOIN "categories" c ON c."id" = NEW."child_category_id"
    WHERE p."id" = NEW."parent_category_id"
      AND p."financial_space_id" = NEW."financial_space_id"
      AND c."financial_space_id" = NEW."financial_space_id"
  ) THEN
    RAISE EXCEPTION 'CATEGORY_EDGE_SPACE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    WITH RECURSIVE descendants("id") AS (
      SELECT e."child_category_id" FROM "category_edges" e WHERE e."parent_category_id" = NEW."child_category_id"
      UNION
      SELECT e."child_category_id" FROM "category_edges" e JOIN descendants d ON e."parent_category_id" = d."id"
    ) SELECT 1 FROM descendants WHERE "id" = NEW."parent_category_id"
  ) THEN
    RAISE EXCEPTION 'CATEGORY_CYCLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "category_edges_integrity_guard" AFTER INSERT OR UPDATE ON "category_edges"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "v2_validate_category_edge"();

CREATE FUNCTION "v2_validate_budget_allocation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "budgets" b JOIN "categories" c ON c."id" = NEW."category_id"
    WHERE b."id" = NEW."budget_id" AND b."financial_space_id" = c."financial_space_id"
  ) THEN
    RAISE EXCEPTION 'BUDGET_CATEGORY_SPACE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "budget_allocations_space_guard" AFTER INSERT OR UPDATE ON "budget_allocations"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "v2_validate_budget_allocation"();

CREATE FUNCTION "v2_validate_ledger_account"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  definition "system_account_definitions"%ROWTYPE;
BEGIN
  IF NEW."kind" = 'SYSTEM' THEN
    SELECT * INTO definition FROM "system_account_definitions" WHERE "code" = NEW."system_role";
    IF NOT FOUND OR definition."normal_side" <> NEW."normal_side" OR definition."allows_negative_balance" <> NEW."allows_negative_balance" THEN
      RAISE EXCEPTION 'LEDGER_SYSTEM_ROLE_POLICY_MISMATCH' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."account_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "accounts" WHERE "id" = NEW."account_id" AND "financial_space_id" = NEW."financial_space_id") THEN
    RAISE EXCEPTION 'LEDGER_ACCOUNT_SPACE_MISMATCH' USING ERRCODE = '23514';
  ELSIF NEW."accumulation_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "accumulations" WHERE "id" = NEW."accumulation_id" AND "financial_space_id" = NEW."financial_space_id") THEN
    RAISE EXCEPTION 'LEDGER_ACCUMULATION_SPACE_MISMATCH' USING ERRCODE = '23514';
  ELSIF NEW."saving_account_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "savings_accounts" WHERE "id" = NEW."saving_account_id" AND "financial_space_id" = NEW."financial_space_id") THEN
    RAISE EXCEPTION 'LEDGER_SAVING_SPACE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF NOT NEW."allows_negative_balance" AND NEW."current_balance" < 0 THEN
    RAISE EXCEPTION 'LEDGER_NEGATIVE_BALANCE_FORBIDDEN' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "ledger_accounts_ownership_guard" AFTER INSERT OR UPDATE ON "ledger_accounts"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "v2_validate_ledger_account"();

CREATE FUNCTION "v2_validate_saving_account"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "ledger_accounts" WHERE "id" = NEW."funding_ledger_account_id" AND "financial_space_id" = NEW."financial_space_id") OR
     (NEW."interest_target_ledger_account_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "ledger_accounts" WHERE "id" = NEW."interest_target_ledger_account_id" AND "financial_space_id" = NEW."financial_space_id")) THEN
    RAISE EXCEPTION 'SAVING_LEDGER_SPACE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF NEW."parent_saving_id" IS NOT NULL AND EXISTS (
    WITH RECURSIVE ancestors("id", "parent_saving_id") AS (
      SELECT s."id", s."parent_saving_id" FROM "savings_accounts" s WHERE s."id" = NEW."parent_saving_id"
      UNION
      SELECT s."id", s."parent_saving_id" FROM "savings_accounts" s JOIN ancestors a ON s."id" = a."parent_saving_id"
    ) SELECT 1 FROM ancestors WHERE "id" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'SAVING_PARENT_CYCLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "savings_accounts_integrity_guard" AFTER INSERT OR UPDATE ON "savings_accounts"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "v2_validate_saving_account"();

CREATE FUNCTION "v2_validate_financial_transaction_scope"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."category_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "categories" WHERE "id" = NEW."category_id" AND "financial_space_id" = NEW."financial_space_id") THEN
    RAISE EXCEPTION 'TRANSACTION_CATEGORY_SPACE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "financial_space_memberships"
    WHERE "financial_space_id" = NEW."financial_space_id" AND "user_id" = NEW."responsible_user_id" AND "status" = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'TRANSACTION_ACTOR_NOT_ACTIVE_MEMBER' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "posting_template_definitions" WHERE "id" = NEW."posting_template_definition_id" AND "status" = 'APPROVED') THEN
    RAISE EXCEPTION 'TRANSACTION_TEMPLATE_NOT_APPROVED' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "financial_transactions_scope_guard" AFTER INSERT OR UPDATE ON "financial_transactions"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "v2_validate_financial_transaction_scope"();

CREATE FUNCTION "v2_prepare_financial_posting"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'DRAFT' AND NEW."status" = 'POSTED' THEN
    IF (NEW."type" = 'REVERSAL') <> (NEW."reverses_transaction_id" IS NOT NULL) THEN
      RAISE EXCEPTION 'REVERSAL_LINK_REQUIRED_ONLY_FOR_REVERSAL_TYPE' USING ERRCODE = '23514';
    END IF;
    NEW."posted_at" := transaction_timestamp();
    RETURN NEW;
  END IF;
  IF OLD."status" = 'POSTED' AND NEW."status" = 'REVERSED' THEN
    IF (to_jsonb(NEW) - ARRAY['status','updated_at']) <> (to_jsonb(OLD) - ARRAY['status','updated_at']) THEN
      RAISE EXCEPTION 'POSTED_TRANSACTION_IMMUTABLE' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD."status" IN ('POSTED', 'REVERSED') THEN
    RAISE EXCEPTION 'POSTED_TRANSACTION_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  IF OLD."status" <> NEW."status" THEN
    RAISE EXCEPTION 'INVALID_TRANSACTION_STATUS_TRANSITION' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "financial_transactions_posting_prepare" BEFORE UPDATE ON "financial_transactions"
  FOR EACH ROW EXECUTE FUNCTION "v2_prepare_financial_posting"();

CREATE FUNCTION "v2_reject_posted_transaction_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" IN ('POSTED', 'REVERSED') THEN
    RAISE EXCEPTION 'POSTED_TRANSACTION_DELETE_FORBIDDEN' USING ERRCODE = '55000';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER "financial_transactions_delete_guard" BEFORE DELETE ON "financial_transactions"
  FOR EACH ROW EXECUTE FUNCTION "v2_reject_posted_transaction_delete"();

CREATE FUNCTION "v2_prepare_ledger_entry"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  transaction_row "financial_transactions"%ROWTYPE;
  account_space BIGINT;
BEGIN
  SELECT * INTO transaction_row FROM "financial_transactions" WHERE "id" = NEW."financial_transaction_id" FOR UPDATE;
  IF NOT FOUND OR transaction_row."status" <> 'DRAFT' THEN
    RAISE EXCEPTION 'LEDGER_ENTRY_REQUIRES_DRAFT_TRANSACTION' USING ERRCODE = '23514';
  END IF;
  SELECT "financial_space_id" INTO account_space FROM "ledger_accounts" WHERE "id" = NEW."ledger_account_id";
  IF account_space IS DISTINCT FROM transaction_row."financial_space_id" THEN
    RAISE EXCEPTION 'LEDGER_ENTRY_SPACE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  NEW."posted_at" := transaction_timestamp();
  RETURN NEW;
END $$;
CREATE TRIGGER "ledger_entries_insert_guard" BEFORE INSERT ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION "v2_prepare_ledger_entry"();

CREATE FUNCTION "v2_reject_immutable_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'APPEND_ONLY_ROW_IMMUTABLE' USING ERRCODE = '55000';
END $$;
CREATE TRIGGER "ledger_entries_immutable" BEFORE UPDATE OR DELETE ON "ledger_entries" FOR EACH ROW EXECUTE FUNCTION "v2_reject_immutable_change"();
CREATE TRIGGER "audit_events_immutable" BEFORE UPDATE OR DELETE ON "audit_events" FOR EACH ROW EXECUTE FUNCTION "v2_reject_immutable_change"();
CREATE TRIGGER "outbox_delivery_attempts_immutable" BEFORE UPDATE OR DELETE ON "outbox_delivery_attempts" FOR EACH ROW EXECUTE FUNCTION "v2_reject_immutable_change"();
CREATE TRIGGER "inbox_receipts_immutable" BEFORE UPDATE OR DELETE ON "inbox_receipts" FOR EACH ROW EXECUTE FUNCTION "v2_reject_immutable_change"();
CREATE TRIGGER "posting_template_entry_roles_immutable" BEFORE UPDATE OR DELETE ON "posting_template_entry_roles" FOR EACH ROW EXECUTE FUNCTION "v2_reject_immutable_change"();

CREATE FUNCTION "v2_validate_posted_transaction"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  current_row "financial_transactions"%ROWTYPE;
  entry_count BIGINT;
  entry_sum NUMERIC;
BEGIN
  SELECT * INTO current_row FROM "financial_transactions" WHERE "id" = NEW."id";
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF current_row."status" = 'DRAFT' THEN
    RAISE EXCEPTION 'DRAFT_TRANSACTION_CANNOT_SURVIVE_COMMIT' USING ERRCODE = '23514';
  END IF;
  SELECT count(*), coalesce(sum("amount"), 0) INTO entry_count, entry_sum
    FROM "ledger_entries" WHERE "financial_transaction_id" = current_row."id";
  IF entry_count < 2 OR entry_sum <> 0 THEN
    RAISE EXCEPTION 'UNBALANCED_POSTED_TRANSACTION' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "ledger_entries" e
    JOIN "ledger_accounts" a ON a."id" = e."ledger_account_id"
    WHERE e."financial_transaction_id" = current_row."id"
      AND (a."financial_space_id" <> current_row."financial_space_id" OR e."posted_at" <> current_row."posted_at")
  ) THEN
    RAISE EXCEPTION 'POSTED_TRANSACTION_ENTRY_SCOPE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF current_row."type" = 'REVERSAL' THEN
    IF current_row."reverses_transaction_id" IS NULL OR NOT EXISTS (
      SELECT 1 FROM "financial_transactions" original
      WHERE original."id" = current_row."reverses_transaction_id"
        AND original."status" IN ('POSTED', 'REVERSED')
        AND original."financial_space_id" = current_row."financial_space_id"
        AND original."amount" = current_row."amount"
    ) THEN
      RAISE EXCEPTION 'REVERSAL_ORIGINAL_MISMATCH' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      WITH original_entries AS (
        SELECT "ledger_account_id", "entry_role", sum("amount") amount
        FROM "ledger_entries" WHERE "financial_transaction_id" = current_row."reverses_transaction_id"
        GROUP BY "ledger_account_id", "entry_role"
      ), reversal_entries AS (
        SELECT "ledger_account_id", "entry_role", sum("amount") amount
        FROM "ledger_entries" WHERE "financial_transaction_id" = current_row."id"
        GROUP BY "ledger_account_id", "entry_role"
      )
      SELECT 1 FROM original_entries original
      FULL JOIN reversal_entries reversal USING ("ledger_account_id", "entry_role")
      WHERE original."amount" IS NULL OR reversal."amount" IS NULL OR reversal."amount" <> -original."amount"
    ) THEN
      RAISE EXCEPTION 'REVERSAL_ENTRIES_NOT_EXACT_OPPOSITE' USING ERRCODE = '23514';
    END IF;
  ELSIF current_row."reverses_transaction_id" IS NOT NULL THEN
    RAISE EXCEPTION 'NON_REVERSAL_CANNOT_REFERENCE_ORIGINAL' USING ERRCODE = '23514';
  END IF;
  IF current_row."type" <> 'REVERSAL' AND EXISTS (
    SELECT 1 FROM "ledger_entries" e
    JOIN "ledger_accounts" a ON a."id" = e."ledger_account_id"
    LEFT JOIN "posting_template_entry_roles" r
      ON r."posting_template_definition_id" = current_row."posting_template_definition_id" AND r."entry_role" = e."entry_role"
    WHERE e."financial_transaction_id" = current_row."id"
      AND (r."id" IS NULL OR r."required_account_kind" <> a."kind"
        OR (r."required_system_role" IS NOT NULL AND r."required_system_role" <> a."system_role")
        OR (r."sign_rule" = 'POSITIVE' AND e."amount" <= 0)
        OR (r."sign_rule" = 'NEGATIVE' AND e."amount" >= 0))
  ) THEN
    RAISE EXCEPTION 'POSTED_TRANSACTION_TEMPLATE_ROLE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF current_row."type" <> 'REVERSAL' AND EXISTS (
    SELECT 1 FROM "posting_template_entry_roles" r
    LEFT JOIN "ledger_entries" e ON e."financial_transaction_id" = current_row."id" AND e."entry_role" = r."entry_role"
    WHERE r."posting_template_definition_id" = current_row."posting_template_definition_id"
    GROUP BY r."id", r."minimum_occurrences", r."maximum_occurrences"
    HAVING count(e."id") < r."minimum_occurrences" OR count(e."id") > r."maximum_occurrences"
  ) THEN
    RAISE EXCEPTION 'POSTED_TRANSACTION_TEMPLATE_CARDINALITY_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF current_row."status" = 'REVERSED' AND NOT EXISTS (
    SELECT 1 FROM "financial_transactions" reversal
    WHERE reversal."reverses_transaction_id" = current_row."id"
      AND reversal."type" = 'REVERSAL'
      AND reversal."status" = 'POSTED'
  ) THEN
    RAISE EXCEPTION 'REVERSED_TRANSACTION_REQUIRES_POSTED_REVERSAL' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "financial_transactions_commit_guard" AFTER INSERT OR UPDATE ON "financial_transactions"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "v2_validate_posted_transaction"();

CREATE FUNCTION "v2_validate_detail_scope"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  transaction_space BIGINT;
  transaction_type "financial_transaction_type";
BEGIN
  SELECT "financial_space_id", "type" INTO transaction_space, transaction_type FROM "financial_transactions" WHERE "id" = NEW."financial_transaction_id";
  IF TG_TABLE_NAME = 'transaction_expense_details' THEN
    IF transaction_type <> 'EXPENSE' OR NOT EXISTS (SELECT 1 FROM "ledger_accounts" WHERE "id" = NEW."source_ledger_account_id" AND "financial_space_id" = transaction_space) THEN
      RAISE EXCEPTION 'EXPENSE_DETAIL_SCOPE_OR_TYPE_MISMATCH' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'transaction_income_details' THEN
    IF transaction_type <> 'INCOME' OR NOT EXISTS (SELECT 1 FROM "ledger_accounts" WHERE "id" = NEW."target_ledger_account_id" AND "financial_space_id" = transaction_space) THEN
      RAISE EXCEPTION 'INCOME_DETAIL_SCOPE_OR_TYPE_MISMATCH' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF transaction_type NOT IN ('TRANSFER', 'ACCUMULATION_CLOSE') OR
       NOT EXISTS (SELECT 1 FROM "ledger_accounts" WHERE "id" = NEW."source_ledger_account_id" AND "financial_space_id" = transaction_space) OR
       NOT EXISTS (SELECT 1 FROM "ledger_accounts" WHERE "id" = NEW."target_ledger_account_id" AND "financial_space_id" = transaction_space) THEN
      RAISE EXCEPTION 'TRANSFER_DETAIL_SCOPE_OR_TYPE_MISMATCH' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "expense_details_scope_guard" AFTER INSERT OR UPDATE ON "transaction_expense_details" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "v2_validate_detail_scope"();
CREATE CONSTRAINT TRIGGER "income_details_scope_guard" AFTER INSERT OR UPDATE ON "transaction_income_details" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "v2_validate_detail_scope"();
CREATE CONSTRAINT TRIGGER "transfer_details_scope_guard" AFTER INSERT OR UPDATE ON "transaction_transfer_details" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "v2_validate_detail_scope"();

CREATE FUNCTION "v2_validate_debt_settlement"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "financial_transactions" t JOIN "debt_agreements" d ON d."id" = NEW."debt_agreement_id"
    JOIN "ledger_accounts" a ON a."id" = NEW."cash_ledger_account_id"
    WHERE t."id" = NEW."financial_transaction_id"
      AND t."financial_space_id" = NEW."financial_space_id"
      AND d."financial_space_id" = NEW."financial_space_id"
      AND a."financial_space_id" = NEW."financial_space_id"
      AND t."amount" = NEW."principal_amount" + NEW."interest_amount"
  ) THEN
    RAISE EXCEPTION 'DEBT_SETTLEMENT_SCOPE_OR_AMOUNT_MISMATCH' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "debt_settlements_integrity_guard" AFTER INSERT OR UPDATE ON "debt_settlements"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "v2_validate_debt_settlement"();

CREATE FUNCTION "v2_validate_interspace_group"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" = 'DRAFT' THEN
    RAISE EXCEPTION 'DRAFT_INTERSPACE_GROUP_CANNOT_SURVIVE_COMMIT' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "financial_space_memberships" WHERE "financial_space_id" = NEW."source_financial_space_id" AND "user_id" = NEW."actor_user_id" AND "role" = 'OWNER' AND "status" = 'ACTIVE') OR
     NOT EXISTS (SELECT 1 FROM "financial_space_memberships" WHERE "financial_space_id" = NEW."target_financial_space_id" AND "user_id" = NEW."actor_user_id" AND "status" = 'ACTIVE') OR
     NOT EXISTS (SELECT 1 FROM "ledger_accounts" WHERE "id" = NEW."source_ledger_account_id" AND "financial_space_id" = NEW."source_financial_space_id" AND "kind" = 'USER_BALANCE') OR
     NOT EXISTS (SELECT 1 FROM "ledger_accounts" WHERE "id" = NEW."target_ledger_account_id" AND "financial_space_id" = NEW."target_financial_space_id" AND "kind" = 'USER_BALANCE') OR
     NOT EXISTS (SELECT 1 FROM "financial_transactions" t JOIN "posting_template_definitions" p ON p."id" = t."posting_template_definition_id" WHERE t."id" = NEW."source_transaction_id" AND t."financial_space_id" = NEW."source_financial_space_id" AND t."amount" = NEW."amount" AND p."code" = 'CONTRIBUTION_OUT') OR
     NOT EXISTS (SELECT 1 FROM "financial_transactions" t JOIN "posting_template_definitions" p ON p."id" = t."posting_template_definition_id" WHERE t."id" = NEW."target_transaction_id" AND t."financial_space_id" = NEW."target_financial_space_id" AND t."amount" = NEW."amount" AND p."code" = 'CONTRIBUTION_IN') THEN
    RAISE EXCEPTION 'INTERSPACE_GROUP_POLICY_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF NEW."status" = 'REVERSED' AND NOT EXISTS (
    SELECT 1
    FROM "interspace_transfer_groups" reversal_group
    JOIN "financial_transactions" source_reversal ON source_reversal."id" = reversal_group."source_transaction_id"
    JOIN "financial_transactions" target_reversal ON target_reversal."id" = reversal_group."target_transaction_id"
    WHERE reversal_group."id" <> NEW."id"
      AND reversal_group."status" = 'POSTED'
      AND source_reversal."reverses_transaction_id" = NEW."source_transaction_id"
      AND target_reversal."reverses_transaction_id" = NEW."target_transaction_id"
      AND reversal_group."amount" = NEW."amount"
  ) THEN
    RAISE EXCEPTION 'REVERSED_INTERSPACE_GROUP_REQUIRES_POSTED_REVERSAL_GROUP' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "interspace_groups_integrity_guard" AFTER INSERT OR UPDATE ON "interspace_transfer_groups"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "v2_validate_interspace_group"();

CREATE FUNCTION "v2_validate_attachment_scope"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE asset_space BIGINT;
BEGIN
  SELECT "financial_space_id" INTO asset_space FROM "temporary_assets" WHERE "id" = NEW."asset_id";
  IF asset_space IS NOT NULL AND NEW."financial_space_id" IS DISTINCT FROM asset_space THEN
    RAISE EXCEPTION 'ATTACHMENT_ASSET_SPACE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF NEW."space_background_space_id" IS NOT NULL AND NEW."financial_space_id" IS DISTINCT FROM NEW."space_background_space_id" THEN
    RAISE EXCEPTION 'ATTACHMENT_BACKGROUND_SPACE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF NEW."financial_transaction_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "financial_transactions" WHERE "id" = NEW."financial_transaction_id" AND "financial_space_id" = NEW."financial_space_id") THEN
    RAISE EXCEPTION 'ATTACHMENT_TRANSACTION_SPACE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "attachments_scope_guard" AFTER INSERT OR UPDATE ON "attachments"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "v2_validate_attachment_scope"();

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC;
