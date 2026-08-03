-- Wave 2 contract hardening: enforce reviewed API V2 invariants at the database boundary.

-- Capture one wall-clock timestamp at the posting transition and stamp the whole entry set.
CREATE OR REPLACE FUNCTION "v2_prepare_financial_posting"() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  posting_time TIMESTAMPTZ;
BEGIN
  IF OLD."status" = 'DRAFT' AND NEW."status" = 'POSTED' THEN
    IF (NEW."type" = 'REVERSAL') <> (NEW."reverses_transaction_id" IS NOT NULL) THEN
      RAISE EXCEPTION 'REVERSAL_LINK_REQUIRED_ONLY_FOR_REVERSAL_TYPE' USING ERRCODE = '23514';
    END IF;
    posting_time := clock_timestamp();
    NEW."posted_at" := posting_time;
    UPDATE "ledger_entries"
       SET "posted_at" = posting_time
     WHERE "financial_transaction_id" = NEW."id";
    RETURN NEW;
  END IF;
  IF OLD."status" = 'POSTED' AND NEW."status" = 'REVERSED' THEN
    IF (to_jsonb(NEW) - ARRAY['status','updated_at']) <> (to_jsonb(OLD) - ARRAY['status','updated_at']) THEN
      RAISE EXCEPTION 'POSTED_TRANSACTION_IMMUTABLE' USING ERRCODE = '55000';
    END IF;
    UPDATE "debt_agreements" debt
       SET "outstanding_principal"=debt."principal_amount", "outstanding_interest"=0,
           "status"='OPEN', "settled_at"=NULL, "updated_at"=clock_timestamp()
      FROM "debt_settlements" settlement
     WHERE settlement."financial_transaction_id"=OLD."id" AND debt."id"=settlement."debt_agreement_id";
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

CREATE OR REPLACE FUNCTION "v2_guard_ledger_entry_change"() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND pg_trigger_depth() > 1 AND
     (to_jsonb(NEW) - 'posted_at') = (to_jsonb(OLD) - 'posted_at') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'APPEND_ONLY_ROW_IMMUTABLE' USING ERRCODE = '55000';
END $$;

DROP TRIGGER "ledger_entries_immutable" ON "ledger_entries";
CREATE TRIGGER "ledger_entries_immutable"
BEFORE UPDATE OR DELETE ON "ledger_entries"
FOR EACH ROW EXECUTE FUNCTION "v2_guard_ledger_entry_change"();

-- A normal user account may start negative only through its first approved opening.
-- Once negative, positive inflow may improve it, but any further outgoing is rejected.
CREATE OR REPLACE FUNCTION "v2_prepare_ledger_entry"() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  transaction_row "financial_transactions"%ROWTYPE;
  account_row "ledger_accounts"%ROWTYPE;
  template_code VARCHAR(64);
  next_balance BIGINT;
  is_first_signed_opening BOOLEAN;
BEGIN
  SELECT * INTO transaction_row FROM "financial_transactions"
  WHERE "id" = NEW."financial_transaction_id" FOR UPDATE;
  IF NOT FOUND OR transaction_row."status" <> 'DRAFT' THEN
    RAISE EXCEPTION 'LEDGER_ENTRY_REQUIRES_DRAFT_TRANSACTION' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO account_row FROM "ledger_accounts" WHERE "id" = NEW."ledger_account_id" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_ACCOUNT_NOT_FOUND' USING ERRCODE = '23503'; END IF;
  IF account_row."status" <> 'ACTIVE' THEN RAISE EXCEPTION 'LEDGER_ACCOUNT_NOT_ACTIVE' USING ERRCODE = '23514'; END IF;
  IF account_row."financial_space_id" IS DISTINCT FROM transaction_row."financial_space_id" THEN
    RAISE EXCEPTION 'LEDGER_ENTRY_SPACE_MISMATCH' USING ERRCODE = '23514';
  END IF;

  SELECT "semantic_rule_code" INTO template_code FROM "posting_template_definitions"
  WHERE "id" = transaction_row."posting_template_definition_id";
  next_balance := account_row."current_balance" + NEW."amount";
  is_first_signed_opening := account_row."kind" = 'USER_BALANCE'
    AND account_row."current_sequence" = 0
    AND transaction_row."type" = 'ACCOUNT_OPENING'
    AND template_code = 'OPENING_BALANCE'
    AND NEW."entry_role" = 'ACCOUNT'
    AND NEW."amount" = transaction_row."amount";

  IF NOT account_row."allows_negative_balance" AND next_balance < 0
     AND NOT is_first_signed_opening AND NEW."amount" < 0 THEN
    RAISE EXCEPTION 'LEDGER_NEGATIVE_BALANCE_FORBIDDEN' USING ERRCODE = '23514';
  END IF;

  NEW."account_sequence" := account_row."current_sequence" + 1;
  NEW."balance_before" := account_row."current_balance";
  NEW."balance_after" := next_balance;
  NEW."posted_at" := transaction_timestamp();
  UPDATE "ledger_accounts"
     SET "current_balance" = next_balance,
         "current_sequence" = NEW."account_sequence",
         "updated_at" = clock_timestamp()
   WHERE "id" = account_row."id";
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "v2_validate_ledger_account"() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE definition "system_account_definitions"%ROWTYPE;
BEGIN
  IF NEW."kind"='SYSTEM' THEN
    SELECT * INTO definition FROM "system_account_definitions" WHERE "code"=NEW."system_role";
    IF NOT FOUND OR definition."normal_side"<>NEW."normal_side" OR definition."allows_negative_balance"<>NEW."allows_negative_balance" THEN
      RAISE EXCEPTION 'LEDGER_SYSTEM_ROLE_POLICY_MISMATCH' USING ERRCODE='23514';
    END IF;
  ELSIF NEW."account_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "accounts" WHERE "id"=NEW."account_id" AND "financial_space_id"=NEW."financial_space_id") THEN
    RAISE EXCEPTION 'LEDGER_ACCOUNT_SPACE_MISMATCH' USING ERRCODE='23514';
  ELSIF NEW."accumulation_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "accumulations" WHERE "id"=NEW."accumulation_id" AND "financial_space_id"=NEW."financial_space_id") THEN
    RAISE EXCEPTION 'LEDGER_ACCUMULATION_SPACE_MISMATCH' USING ERRCODE='23514';
  ELSIF NEW."saving_account_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "savings_accounts" WHERE "id"=NEW."saving_account_id" AND "financial_space_id"=NEW."financial_space_id") THEN
    RAISE EXCEPTION 'LEDGER_SAVING_SPACE_MISMATCH' USING ERRCODE='23514';
  END IF;
  IF NOT NEW."allows_negative_balance" AND NEW."current_balance"<0 AND NOT EXISTS (
    SELECT 1 FROM "ledger_entries" e JOIN "financial_transactions" t ON t."id"=e."financial_transaction_id"
    JOIN "posting_template_definitions" p ON p."id"=t."posting_template_definition_id"
    WHERE e."ledger_account_id"=NEW."id" AND e."account_sequence"=1 AND e."entry_role"='ACCOUNT'
      AND e."amount"<0 AND t."type"='ACCOUNT_OPENING' AND p."semantic_rule_code"='OPENING_BALANCE'
  ) THEN RAISE EXCEPTION 'LEDGER_NEGATIVE_BALANCE_FORBIDDEN' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

-- REVERSAL headers use positive magnitude even when the original signed opening was negative.
CREATE OR REPLACE FUNCTION "v2_reversal_header_matches"(reversal_amount BIGINT, original_amount BIGINT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT reversal_amount = abs(original_amount);
$$;

-- Replace only the reversal header comparison inside the existing deferred validator.
CREATE OR REPLACE FUNCTION "v2_validate_posted_transaction"() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_row "financial_transactions"%ROWTYPE;
  template_row "posting_template_definitions"%ROWTYPE;
  entry_count BIGINT;
  entry_sum NUMERIC;
  permits_no_posting BOOLEAN;
BEGIN
  SELECT * INTO current_row FROM "financial_transactions" WHERE "id" = NEW."id";
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF current_row."status" = 'DRAFT' THEN RAISE EXCEPTION 'DRAFT_TRANSACTION_CANNOT_SURVIVE_COMMIT' USING ERRCODE = '23514'; END IF;
  SELECT * INTO template_row FROM "posting_template_definitions" WHERE "id" = current_row."posting_template_definition_id";
  SELECT count(*), coalesce(sum("amount"), 0) INTO entry_count, entry_sum FROM "ledger_entries" WHERE "financial_transaction_id" = current_row."id";
  permits_no_posting := (template_row."semantic_rule_code" = 'OPENING_BALANCE' AND current_row."amount" = 0)
    OR (template_row."semantic_rule_code" = 'ACCUMULATION_OPENING' AND current_row."amount" = 0);
  IF (permits_no_posting AND entry_count <> 0) OR (NOT permits_no_posting AND entry_count < 2) OR entry_sum <> 0 THEN
    RAISE EXCEPTION 'UNBALANCED_POSTED_TRANSACTION' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM "ledger_entries" e JOIN "ledger_accounts" a ON a."id"=e."ledger_account_id"
    WHERE e."financial_transaction_id"=current_row."id" AND (a."financial_space_id"<>current_row."financial_space_id" OR e."posted_at"<>current_row."posted_at")) THEN
    RAISE EXCEPTION 'POSTED_TRANSACTION_ENTRY_SCOPE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF current_row."type" = 'REVERSAL' THEN
    IF current_row."reverses_transaction_id" IS NULL OR NOT EXISTS (
      SELECT 1 FROM "financial_transactions" original
      WHERE original."id"=current_row."reverses_transaction_id" AND original."status" IN ('POSTED','REVERSED')
        AND original."financial_space_id"=current_row."financial_space_id"
        AND "v2_reversal_header_matches"(current_row."amount", original."amount")
    ) THEN RAISE EXCEPTION 'REVERSAL_ORIGINAL_MISMATCH' USING ERRCODE = '23514'; END IF;
    IF EXISTS (SELECT 1 FROM "debt_agreements" WHERE "origin_transaction_id"=current_row."reverses_transaction_id") THEN
      RAISE EXCEPTION 'DEBT_ORIGIN_REVERSAL_UNSUPPORTED' USING ERRCODE='23514';
    END IF;
    IF EXISTS (
      WITH original_entries AS (SELECT "ledger_account_id","entry_role",sum("amount") amount FROM "ledger_entries" WHERE "financial_transaction_id"=current_row."reverses_transaction_id" GROUP BY 1,2),
      reversal_entries AS (SELECT "ledger_account_id","entry_role",sum("amount") amount FROM "ledger_entries" WHERE "financial_transaction_id"=current_row."id" GROUP BY 1,2)
      SELECT 1 FROM original_entries original FULL JOIN reversal_entries reversal USING ("ledger_account_id","entry_role")
      WHERE original.amount IS NULL OR reversal.amount IS NULL OR reversal.amount <> -original.amount
    ) THEN RAISE EXCEPTION 'REVERSAL_ENTRIES_NOT_EXACT_OPPOSITE' USING ERRCODE = '23514'; END IF;
  ELSIF current_row."reverses_transaction_id" IS NOT NULL THEN
    RAISE EXCEPTION 'NON_REVERSAL_CANNOT_REFERENCE_ORIGINAL' USING ERRCODE = '23514';
  END IF;
  IF current_row."type" <> 'REVERSAL' AND EXISTS (
    SELECT 1 FROM "ledger_entries" e JOIN "ledger_accounts" a ON a."id"=e."ledger_account_id"
    LEFT JOIN "posting_template_entry_roles" r ON r."posting_template_definition_id"=current_row."posting_template_definition_id" AND r."entry_role"=e."entry_role"
    WHERE e."financial_transaction_id"=current_row."id" AND (r."id" IS NULL OR r."required_account_kind"<>a."kind"
      OR (r."required_system_role" IS NOT NULL AND r."required_system_role"<>a."system_role")
      OR (r."sign_rule"='POSITIVE' AND e."amount"<=0) OR (r."sign_rule"='NEGATIVE' AND e."amount">=0))
  ) THEN RAISE EXCEPTION 'POSTED_TRANSACTION_TEMPLATE_ROLE_MISMATCH' USING ERRCODE = '23514'; END IF;
  IF current_row."type" <> 'REVERSAL' AND NOT permits_no_posting AND EXISTS (
    SELECT 1 FROM "posting_template_entry_roles" r LEFT JOIN "ledger_entries" e
      ON e."financial_transaction_id"=current_row."id" AND e."entry_role"=r."entry_role"
    WHERE r."posting_template_definition_id"=current_row."posting_template_definition_id"
    GROUP BY r."id",r."minimum_occurrences",r."maximum_occurrences"
    HAVING count(e."id")<r."minimum_occurrences" OR count(e."id")>r."maximum_occurrences"
  ) THEN RAISE EXCEPTION 'POSTED_TRANSACTION_TEMPLATE_CARDINALITY_MISMATCH' USING ERRCODE = '23514'; END IF;
  IF current_row."type" IN ('LOAN_DISBURSEMENT','BORROWING') AND NOT EXISTS (
    SELECT 1 FROM "debt_agreements" debt
    WHERE debt."origin_transaction_id"=current_row."id" AND debt."financial_space_id"=current_row."financial_space_id"
      AND debt."principal_amount"=current_row."amount" AND debt."status"='OPEN'
      AND debt."outstanding_principal"=debt."principal_amount" AND debt."outstanding_interest"=0
      AND debt."settled_at" IS NULL
      AND ((current_row."type"='LOAN_DISBURSEMENT' AND debt."direction"='RECEIVABLE')
        OR (current_row."type"='BORROWING' AND debt."direction"='PAYABLE'))
  ) THEN RAISE EXCEPTION 'DEBT_ORIGIN_INITIAL_STATE_INVALID' USING ERRCODE='23514'; END IF;
  PERFORM "v2_validate_posting_semantics"(current_row."id");
  IF current_row."status"='REVERSED' AND NOT EXISTS (SELECT 1 FROM "financial_transactions" reversal
    WHERE reversal."reverses_transaction_id"=current_row."id" AND reversal."type"='REVERSAL' AND reversal."status"='POSTED') THEN
    RAISE EXCEPTION 'REVERSED_TRANSACTION_REQUIRES_POSTED_REVERSAL' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;

-- Typed financial facts are created with a compatible DRAFT parent and freeze once posted.
CREATE FUNCTION "v2_guard_typed_financial_fact"() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  parent_id BIGINT;
  old_parent_id BIGINT;
  parent_status "financial_transaction_status";
  old_parent_status "financial_transaction_status";
  parent_type "financial_transaction_type";
  expected BOOLEAN := false;
BEGIN
  IF TG_OP='DELETE' THEN
    parent_id := COALESCE((to_jsonb(OLD)->>'origin_transaction_id')::BIGINT,(to_jsonb(OLD)->>'financial_transaction_id')::BIGINT);
  ELSE
    parent_id := COALESCE((to_jsonb(NEW)->>'origin_transaction_id')::BIGINT,(to_jsonb(NEW)->>'financial_transaction_id')::BIGINT);
  END IF;
  IF TG_OP='UPDATE' THEN
    old_parent_id := COALESCE((to_jsonb(OLD)->>'origin_transaction_id')::BIGINT,(to_jsonb(OLD)->>'financial_transaction_id')::BIGINT);
  END IF;
  IF TG_TABLE_NAME='debt_agreements' AND TG_OP='UPDATE' AND pg_trigger_depth()>1
     AND (to_jsonb(NEW)->>'origin_transaction_id')=(to_jsonb(OLD)->>'origin_transaction_id')
     AND (to_jsonb(NEW)-ARRAY['outstanding_principal','outstanding_interest','status','settled_at','updated_at']) =
         (to_jsonb(OLD)-ARRAY['outstanding_principal','outstanding_interest','status','settled_at','updated_at']) THEN
    RETURN NEW;
  END IF;
  IF TG_OP='UPDATE' AND old_parent_id IS DISTINCT FROM parent_id THEN
    SELECT "status" INTO old_parent_status FROM "financial_transactions" WHERE "id"=old_parent_id FOR UPDATE;
    IF old_parent_status IN ('POSTED','REVERSED') THEN
      RAISE EXCEPTION 'POSTED_TYPED_FACT_IMMUTABLE' USING ERRCODE='55000';
    END IF;
  END IF;
  SELECT "status","type" INTO parent_status,parent_type FROM "financial_transactions" WHERE "id"=parent_id FOR UPDATE;
  IF parent_status IS NULL THEN RAISE EXCEPTION 'TYPED_FACT_PARENT_NOT_FOUND' USING ERRCODE='23503'; END IF;
  IF TG_OP IN ('UPDATE','DELETE') AND parent_status IN ('POSTED','REVERSED') THEN
    RAISE EXCEPTION 'POSTED_TYPED_FACT_IMMUTABLE' USING ERRCODE='55000';
  END IF;
  IF TG_OP='INSERT' AND parent_status <> 'DRAFT' THEN RAISE EXCEPTION 'TYPED_FACT_REQUIRES_DRAFT_PARENT' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND old_parent_id IS DISTINCT FROM parent_id AND parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'TYPED_FACT_REBIND_REQUIRES_DRAFT_PARENT' USING ERRCODE='23514';
  END IF;
  expected := CASE TG_TABLE_NAME
    WHEN 'transaction_expense_details' THEN parent_type='EXPENSE'
    WHEN 'transaction_income_details' THEN parent_type='INCOME'
    WHEN 'transaction_transfer_details' THEN parent_type IN ('TRANSFER','ACCUMULATION_CLOSE')
    WHEN 'debt_agreements' THEN parent_type IN ('LOAN_DISBURSEMENT','BORROWING')
    WHEN 'debt_settlements' THEN parent_type IN ('REPAYMENT','COLLECTION')
    WHEN 'transaction_saving_details' THEN parent_type IN ('SAVING_DEPOSIT','SAVING_INTEREST_MONTHLY','SAVING_INTEREST_MATURITY','SAVING_CLOSE','SAVING_ROLLOVER_PRINCIPAL','SAVING_ROLLOVER_PRINCIPAL_INTEREST')
    WHEN 'migration_anchor_details' THEN parent_type='ACCOUNT_OPENING'
    ELSE false END;
  IF NOT expected THEN RAISE EXCEPTION 'TYPED_FACT_TRANSACTION_TYPE_MISMATCH' USING ERRCODE='23514'; END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE TRIGGER "expense_details_lifecycle_guard" BEFORE INSERT OR UPDATE OR DELETE ON "transaction_expense_details" FOR EACH ROW EXECUTE FUNCTION "v2_guard_typed_financial_fact"();
CREATE TRIGGER "income_details_lifecycle_guard" BEFORE INSERT OR UPDATE OR DELETE ON "transaction_income_details" FOR EACH ROW EXECUTE FUNCTION "v2_guard_typed_financial_fact"();
CREATE TRIGGER "transfer_details_lifecycle_guard" BEFORE INSERT OR UPDATE OR DELETE ON "transaction_transfer_details" FOR EACH ROW EXECUTE FUNCTION "v2_guard_typed_financial_fact"();
CREATE FUNCTION "v2_initialize_debt_agreement"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW."legacy_mongo_id" IS NULL THEN
    IF NEW."status"<>'OPEN' OR (NEW."outstanding_principal" IS NOT NULL AND NEW."outstanding_principal"<>NEW."principal_amount")
       OR NEW."outstanding_interest"<>0 OR NEW."settled_at" IS NOT NULL THEN
      RAISE EXCEPTION 'DEBT_INITIAL_STATE_INVALID' USING ERRCODE='23514';
    END IF;
    NEW."outstanding_principal" := NEW."principal_amount";
    NEW."outstanding_interest" := 0;
    NEW."settled_at" := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "debt_agreements_initial_state_guard" BEFORE INSERT ON "debt_agreements"
FOR EACH ROW EXECUTE FUNCTION "v2_initialize_debt_agreement"();
CREATE TRIGGER "debt_agreements_parent_guard" BEFORE INSERT OR UPDATE ON "debt_agreements" FOR EACH ROW EXECUTE FUNCTION "v2_guard_typed_financial_fact"();
CREATE TRIGGER "debt_settlements_lifecycle_guard" BEFORE INSERT OR UPDATE OR DELETE ON "debt_settlements" FOR EACH ROW EXECUTE FUNCTION "v2_guard_typed_financial_fact"();
CREATE TRIGGER "saving_details_lifecycle_guard" BEFORE INSERT OR UPDATE OR DELETE ON "transaction_saving_details" FOR EACH ROW EXECUTE FUNCTION "v2_guard_typed_financial_fact"();
-- migration_anchor_details already has a stricter immutable trigger; validate its insert path as well.
CREATE TRIGGER "migration_anchor_details_lifecycle_guard" BEFORE INSERT ON "migration_anchor_details" FOR EACH ROW EXECUTE FUNCTION "v2_guard_typed_financial_fact"();

CREATE FUNCTION "v2_guard_debt_agreement"() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'DEBT_AGREEMENT_DELETE_FORBIDDEN' USING ERRCODE='55000'; END IF;
  IF pg_trigger_depth()>1 AND
     (to_jsonb(NEW)-ARRAY['outstanding_principal','outstanding_interest','status','settled_at','updated_at']) =
     (to_jsonb(OLD)-ARRAY['outstanding_principal','outstanding_interest','status','settled_at','updated_at']) THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM "financial_transactions" WHERE "id"=OLD."origin_transaction_id" AND "status" IN ('POSTED','REVERSED')) THEN
    RAISE EXCEPTION 'POSTED_TYPED_FACT_IMMUTABLE' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "debt_agreements_change_guard" BEFORE UPDATE OR DELETE ON "debt_agreements" FOR EACH ROW EXECUTE FUNCTION "v2_guard_debt_agreement"();

-- DEC-066: a settlement consumes the complete outstanding principal under a row lock.
CREATE FUNCTION "v2_apply_full_debt_settlement"() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  debt "debt_agreements"%ROWTYPE;
  transaction_row "financial_transactions"%ROWTYPE;
BEGIN
  SELECT * INTO transaction_row FROM "financial_transactions" WHERE "id"=NEW."financial_transaction_id" FOR UPDATE;
  SELECT * INTO debt FROM "debt_agreements" WHERE "id"=NEW."debt_agreement_id" FOR UPDATE;
  IF transaction_row."status" <> 'DRAFT' OR debt."status" <> 'OPEN' OR debt."outstanding_principal" <= 0
     OR NOT EXISTS (SELECT 1 FROM "financial_transactions" origin WHERE origin."id"=debt."origin_transaction_id" AND origin."status"='POSTED')
     OR NEW."principal_amount" <> debt."outstanding_principal" OR NEW."interest_amount" <> 0
     OR NEW."principal_amount" <> transaction_row."amount"
     OR NEW."financial_space_id" <> debt."financial_space_id" OR NEW."financial_space_id" <> transaction_row."financial_space_id"
     OR (transaction_row."type"='REPAYMENT' AND debt."direction"<>'PAYABLE')
     OR (transaction_row."type"='COLLECTION' AND debt."direction"<>'RECEIVABLE')
     OR transaction_row."type" NOT IN ('REPAYMENT','COLLECTION')
     OR EXISTS (SELECT 1 FROM "debt_settlements" s JOIN "financial_transactions" t ON t."id"=s."financial_transaction_id"
       WHERE s."debt_agreement_id"=debt."id" AND t."status"<>'REVERSED') THEN
    RAISE EXCEPTION 'DEBT_FULL_SETTLEMENT_REQUIRED' USING ERRCODE='23514';
  END IF;
  UPDATE "debt_agreements" SET "outstanding_principal"=0,"outstanding_interest"=0,"status"='SETTLED',
    "settled_at"=NEW."occurred_at","updated_at"=clock_timestamp() WHERE "id"=debt."id";
  RETURN NEW;
END $$;

CREATE TRIGGER "debt_settlements_full_principal_guard"
BEFORE INSERT ON "debt_settlements" FOR EACH ROW EXECUTE FUNCTION "v2_apply_full_debt_settlement"();

-- Exactly one active owner per live space; a user may actively own only one personal space.
CREATE UNIQUE INDEX "financial_space_memberships_one_active_owner_per_space"
ON "financial_space_memberships" ("financial_space_id") WHERE "role"='OWNER' AND "status"='ACTIVE';

CREATE FUNCTION "v2_validate_space_ownership_ids"(p_space_id BIGINT, p_user_id BIGINT) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE live_space BOOLEAN; owner_count BIGINT; personal_count BIGINT;
BEGIN
  IF p_space_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(8202, (p_space_id % 2147483647)::INTEGER);
    SELECT ("deleted_at" IS NULL) INTO live_space FROM "financial_spaces" WHERE "id"=p_space_id;
    IF coalesce(live_space,false) THEN
      SELECT count(*) INTO owner_count FROM "financial_space_memberships"
       WHERE "financial_space_id"=p_space_id AND "role"='OWNER' AND "status"='ACTIVE';
      IF owner_count <> 1 THEN RAISE EXCEPTION 'FINANCIAL_SPACE_REQUIRES_ONE_ACTIVE_OWNER' USING ERRCODE='23514'; END IF;
    END IF;
  END IF;
  IF p_user_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(8203, (p_user_id % 2147483647)::INTEGER);
    SELECT count(*) INTO personal_count FROM "financial_space_memberships" m JOIN "financial_spaces" s ON s."id"=m."financial_space_id"
     WHERE m."user_id"=p_user_id AND m."role"='OWNER' AND m."status"='ACTIVE' AND s."kind"='PERSONAL' AND s."deleted_at" IS NULL;
    IF personal_count > 1 THEN RAISE EXCEPTION 'USER_HAS_MULTIPLE_ACTIVE_PERSONAL_SPACES' USING ERRCODE='23514'; END IF;
  END IF;
END $$;

CREATE FUNCTION "v2_validate_membership_ownership"() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    PERFORM "v2_validate_space_ownership_ids"(OLD."financial_space_id",OLD."user_id");
    RETURN NULL;
  END IF;
  PERFORM "v2_validate_space_ownership_ids"(NEW."financial_space_id",NEW."user_id");
  IF TG_OP='UPDATE' AND (OLD."financial_space_id"<>NEW."financial_space_id" OR OLD."user_id"<>NEW."user_id") THEN
    PERFORM "v2_validate_space_ownership_ids"(OLD."financial_space_id",OLD."user_id");
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "financial_space_memberships_owner_guard" AFTER INSERT OR UPDATE OR DELETE ON "financial_space_memberships"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "v2_validate_membership_ownership"();

CREATE FUNCTION "v2_validate_space_ownership"() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN PERFORM "v2_validate_space_ownership_ids"(NEW."id",NULL); RETURN NULL; END $$;
CREATE CONSTRAINT TRIGGER "financial_spaces_owner_guard" AFTER INSERT OR UPDATE ON "financial_spaces"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "v2_validate_space_ownership"();

CREATE FUNCTION "v2_guard_governed_space_identity"() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_TABLE_NAME='financial_spaces' THEN
    IF NEW."kind" IS DISTINCT FROM OLD."kind" THEN RAISE EXCEPTION 'FINANCIAL_SPACE_KIND_IMMUTABLE' USING ERRCODE='55000'; END IF;
  ELSIF TG_TABLE_NAME='financial_space_memberships' THEN
    IF ROW(NEW."financial_space_id",NEW."user_id") IS DISTINCT FROM ROW(OLD."financial_space_id",OLD."user_id") THEN
      RAISE EXCEPTION 'MEMBERSHIP_OWNERSHIP_IDENTITY_IMMUTABLE' USING ERRCODE='55000';
    END IF;
  ELSIF NEW."financial_space_id" IS DISTINCT FROM OLD."financial_space_id" THEN
    RAISE EXCEPTION 'GOVERNED_FINANCIAL_SPACE_IMMUTABLE' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "financial_spaces_kind_guard" BEFORE UPDATE ON "financial_spaces" FOR EACH ROW EXECUTE FUNCTION "v2_guard_governed_space_identity"();
CREATE TRIGGER "financial_space_memberships_identity_guard" BEFORE UPDATE ON "financial_space_memberships" FOR EACH ROW EXECUTE FUNCTION "v2_guard_governed_space_identity"();
CREATE TRIGGER "accounts_space_identity_guard" BEFORE UPDATE ON "accounts" FOR EACH ROW EXECUTE FUNCTION "v2_guard_governed_space_identity"();
CREATE TRIGGER "accumulations_space_identity_guard" BEFORE UPDATE ON "accumulations" FOR EACH ROW EXECUTE FUNCTION "v2_guard_governed_space_identity"();
CREATE TRIGGER "savings_accounts_space_identity_guard" BEFORE UPDATE ON "savings_accounts" FOR EACH ROW EXECUTE FUNCTION "v2_guard_governed_space_identity"();
CREATE TRIGGER "categories_space_identity_guard" BEFORE UPDATE ON "categories" FOR EACH ROW EXECUTE FUNCTION "v2_guard_governed_space_identity"();
CREATE TRIGGER "contacts_space_identity_guard" BEFORE UPDATE ON "contacts" FOR EACH ROW EXECUTE FUNCTION "v2_guard_governed_space_identity"();
CREATE TRIGGER "budgets_space_identity_guard" BEFORE UPDATE ON "budgets" FOR EACH ROW EXECUTE FUNCTION "v2_guard_governed_space_identity"();
CREATE TRIGGER "ledger_accounts_space_identity_guard" BEFORE UPDATE ON "ledger_accounts" FOR EACH ROW EXECUTE FUNCTION "v2_guard_governed_space_identity"();
CREATE TRIGGER "financial_transactions_space_identity_guard" BEFORE UPDATE ON "financial_transactions" FOR EACH ROW EXECUTE FUNCTION "v2_guard_governed_space_identity"();
CREATE TRIGGER "debt_agreements_space_identity_guard" BEFORE UPDATE ON "debt_agreements" FOR EACH ROW EXECUTE FUNCTION "v2_guard_governed_space_identity"();
CREATE TRIGGER "debt_settlements_space_identity_guard" BEFORE UPDATE ON "debt_settlements" FOR EACH ROW EXECUTE FUNCTION "v2_guard_governed_space_identity"();

-- Durable idempotency identity/hash/tombstone and terminal state are one-way.
CREATE FUNCTION "v2_guard_idempotency_record"() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE terminal_now TIMESTAMPTZ;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'IDEMPOTENCY_TOMBSTONE_DELETE_FORBIDDEN' USING ERRCODE='55000'; END IF;
  IF TG_OP='INSERT' AND NEW."status"<>'IN_PROGRESS' THEN
    RAISE EXCEPTION 'IDEMPOTENCY_INSERT_REQUIRES_IN_PROGRESS' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND ROW(NEW."public_id",NEW."financial_space_id",NEW."actor_type",NEW."actor_id",NEW."operation",NEW."idempotency_key",NEW."request_hash",NEW."created_at")
    IS DISTINCT FROM ROW(OLD."public_id",OLD."financial_space_id",OLD."actor_type",OLD."actor_id",OLD."operation",OLD."idempotency_key",OLD."request_hash",OLD."created_at") THEN
    RAISE EXCEPTION 'IDEMPOTENCY_IDENTITY_IMMUTABLE' USING ERRCODE='55000';
  END IF;
  IF TG_OP='UPDATE' AND OLD."status"<>'IN_PROGRESS' THEN
    IF (to_jsonb(NEW)-ARRAY['response_body','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['response_body','updated_at'])
       OR NOT (OLD."response_body" IS NOT NULL AND NEW."response_body" IS NULL)
       OR OLD."response_purge_after" IS NULL OR OLD."response_purge_after">clock_timestamp() THEN
      RAISE EXCEPTION 'IDEMPOTENCY_TERMINAL_FACTS_IMMUTABLE' USING ERRCODE='55000';
    END IF;
  END IF;
  IF TG_OP='UPDATE' AND OLD."status"='IN_PROGRESS' AND NEW."status" IN ('COMPLETED','FAILED_FINAL') THEN
    terminal_now := clock_timestamp();
    IF NEW."response_body" IS NOT NULL AND NEW."response_purge_after" IS NOT NULL
       AND NEW."response_purge_after" < terminal_now + interval '90 days' THEN
      RAISE EXCEPTION 'IDEMPOTENCY_RESPONSE_RETENTION_TOO_SHORT' USING ERRCODE='23514';
    END IF;
    NEW."completed_at" := terminal_now;
    IF NEW."response_body" IS NOT NULL THEN
      NEW."response_purge_after" := COALESCE(NEW."response_purge_after", terminal_now + interval '90 days');
    ELSE
      NEW."response_purge_after" := NULL;
    END IF;
  END IF;
  IF NEW."status"='IN_PROGRESS' THEN
    IF NEW."resource_type" IS NOT NULL OR NEW."resource_public_id" IS NOT NULL OR NEW."response_status" IS NOT NULL
       OR NEW."response_body" IS NOT NULL OR NEW."error_code" IS NOT NULL OR NEW."completed_at" IS NOT NULL
       OR NEW."response_purge_after" IS NOT NULL THEN
      RAISE EXCEPTION 'IDEMPOTENCY_IN_PROGRESS_FACTS_FORBIDDEN' USING ERRCODE='23514';
    END IF;
  ELSIF NEW."status"='COMPLETED' THEN
    IF NEW."resource_type" IS NULL OR NEW."resource_public_id" IS NULL OR NEW."response_status" NOT BETWEEN 200 AND 399
       OR NEW."error_code" IS NOT NULL OR NEW."completed_at" IS NULL
       OR (NEW."response_body" IS NOT NULL AND NEW."response_purge_after" < NEW."completed_at" + interval '90 days')
       OR NEW."lease_owner" IS NOT NULL OR NEW."lease_expires_at" IS NOT NULL THEN
      RAISE EXCEPTION 'IDEMPOTENCY_COMPLETED_FACTS_REQUIRED' USING ERRCODE='23514';
    END IF;
  ELSIF NEW."status"='FAILED_FINAL' THEN
    IF NEW."resource_type" IS NOT NULL OR NEW."resource_public_id" IS NOT NULL OR NEW."error_code" IS NULL
       OR NEW."completed_at" IS NULL OR (NEW."response_status" IS NOT NULL AND NEW."response_status"<400)
       OR (NEW."response_body" IS NOT NULL AND NEW."response_purge_after" < NEW."completed_at" + interval '90 days')
       OR NEW."lease_owner" IS NOT NULL OR NEW."lease_expires_at" IS NOT NULL THEN
      RAISE EXCEPTION 'IDEMPOTENCY_FAILED_FACTS_REQUIRED' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "idempotency_records_state_guard" BEFORE INSERT OR UPDATE OR DELETE ON "idempotency_records" FOR EACH ROW EXECUTE FUNCTION "v2_guard_idempotency_record"();

-- Outbox intent is immutable; worker state advances explicitly and terminal events never reopen.
CREATE FUNCTION "v2_guard_outbox_event"() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'OUTBOX_EVENT_DELETE_FORBIDDEN' USING ERRCODE='55000'; END IF;
  IF ROW(NEW."public_id",NEW."financial_space_id",NEW."aggregate_type",NEW."aggregate_public_id",NEW."aggregate_sequence",NEW."event_type",NEW."event_schema_version",NEW."payload",NEW."created_at")
    IS DISTINCT FROM ROW(OLD."public_id",OLD."financial_space_id",OLD."aggregate_type",OLD."aggregate_public_id",OLD."aggregate_sequence",OLD."event_type",OLD."event_schema_version",OLD."payload",OLD."created_at") THEN
    RAISE EXCEPTION 'OUTBOX_EVENT_INTENT_IMMUTABLE' USING ERRCODE='55000';
  END IF;
  IF NEW."attempt_count" < OLD."attempt_count" THEN RAISE EXCEPTION 'OUTBOX_ATTEMPT_COUNT_CANNOT_DECREASE' USING ERRCODE='23514'; END IF;
  IF OLD."status" IN ('DELIVERED','DEAD_LETTER','REQUIRES_REVIEW') AND NEW."status"<>OLD."status" THEN RAISE EXCEPTION 'OUTBOX_TERMINAL_STATE_IMMUTABLE' USING ERRCODE='23514'; END IF;
  IF (OLD."status",NEW."status") NOT IN (('PENDING','PENDING'),('PENDING','PROCESSING'),('PROCESSING','PROCESSING'),('PROCESSING','PENDING'),('PROCESSING','DELIVERED'),('PROCESSING','DEAD_LETTER'),('PROCESSING','REQUIRES_REVIEW'),('DELIVERED','DELIVERED'),('DEAD_LETTER','DEAD_LETTER'),('REQUIRES_REVIEW','REQUIRES_REVIEW')) THEN
    RAISE EXCEPTION 'OUTBOX_STATUS_TRANSITION_FORBIDDEN' USING ERRCODE='23514';
  END IF;
  IF NEW."status"='PROCESSING' AND (NEW."lease_owner" IS NULL OR NEW."lease_expires_at" IS NULL) THEN RAISE EXCEPTION 'OUTBOX_PROCESSING_LEASE_REQUIRED' USING ERRCODE='23514'; END IF;
  IF NEW."status"<>'PROCESSING' AND (NEW."lease_owner" IS NOT NULL OR NEW."lease_expires_at" IS NOT NULL) THEN RAISE EXCEPTION 'OUTBOX_NONPROCESSING_LEASE_FORBIDDEN' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "outbox_events_state_guard" BEFORE UPDATE OR DELETE ON "outbox_events" FOR EACH ROW EXECUTE FUNCTION "v2_guard_outbox_event"();

CREATE FUNCTION "v2_guard_outbox_attempt"() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'OUTBOX_ATTEMPT_DELETE_FORBIDDEN' USING ERRCODE='55000'; END IF;
  IF ROW(NEW."public_id",NEW."outbox_event_id",NEW."attempt_number",NEW."provider",NEW."provider_idempotency_key",NEW."started_at")
    IS DISTINCT FROM ROW(OLD."public_id",OLD."outbox_event_id",OLD."attempt_number",OLD."provider",OLD."provider_idempotency_key",OLD."started_at") THEN
    RAISE EXCEPTION 'OUTBOX_ATTEMPT_IDENTITY_IMMUTABLE' USING ERRCODE='55000';
  END IF;
  IF OLD."status"<>'STARTED' OR NEW."status"='STARTED' THEN RAISE EXCEPTION 'OUTBOX_ATTEMPT_TERMINAL_STATE_IMMUTABLE' USING ERRCODE='23514'; END IF;
  IF NEW."finished_at" IS NULL THEN RAISE EXCEPTION 'OUTBOX_ATTEMPT_FINISHED_AT_REQUIRED' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER "outbox_delivery_attempts_immutable" ON "outbox_delivery_attempts";
CREATE TRIGGER "outbox_delivery_attempts_state_guard" BEFORE UPDATE OR DELETE ON "outbox_delivery_attempts" FOR EACH ROW EXECUTE FUNCTION "v2_guard_outbox_attempt"();

-- Contribution group links/provenance are immutable and lifecycle is monotonic.
CREATE FUNCTION "v2_guard_interspace_group"() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'INTERSPACE_GROUP_DELETE_FORBIDDEN' USING ERRCODE='55000'; END IF;
  IF (to_jsonb(NEW)-ARRAY['status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','updated_at']) THEN
    RAISE EXCEPTION 'INTERSPACE_GROUP_IDENTITY_IMMUTABLE' USING ERRCODE='55000';
  END IF;
  IF (OLD."status",NEW."status") NOT IN (('DRAFT','DRAFT'),('DRAFT','POSTED'),('POSTED','POSTED'),('POSTED','REVERSED'),('REVERSED','REVERSED')) THEN
    RAISE EXCEPTION 'INTERSPACE_GROUP_STATUS_TRANSITION_FORBIDDEN' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "interspace_transfer_groups_state_guard" BEFORE UPDATE OR DELETE ON "interspace_transfer_groups" FOR EACH ROW EXECUTE FUNCTION "v2_guard_interspace_group"();

-- Cross-aggregate scope checks omitted by the initial physical migration.
CREATE FUNCTION "v2_validate_debt_agreement_scope"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "contacts" WHERE "id"=NEW."counterparty_contact_id" AND "financial_space_id"=NEW."financial_space_id") THEN
    RAISE EXCEPTION 'DEBT_CONTACT_SPACE_MISMATCH' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "debt_agreements_contact_space_guard" AFTER INSERT OR UPDATE ON "debt_agreements"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "v2_validate_debt_agreement_scope"();

CREATE FUNCTION "v2_validate_saving_detail_period"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW."saving_period_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "saving_periods" WHERE "id"=NEW."saving_period_id" AND "saving_account_id"=NEW."saving_account_id"
  ) THEN RAISE EXCEPTION 'SAVING_DETAIL_PERIOD_ACCOUNT_MISMATCH' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "saving_details_period_account_guard" AFTER INSERT OR UPDATE ON "transaction_saving_details"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "v2_validate_saving_detail_period"();

CREATE OR REPLACE FUNCTION "v2_validate_attachment_scope"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE asset_space BIGINT; asset_owner BIGINT;
BEGIN
  SELECT "financial_space_id","owner_user_id" INTO asset_space,asset_owner FROM "temporary_assets" WHERE "id"=NEW."asset_id";
  IF asset_owner IS NULL THEN RAISE EXCEPTION 'ATTACHMENT_ASSET_NOT_FOUND' USING ERRCODE='23503'; END IF;
  IF NEW."linked_by_user_id"<>asset_owner THEN RAISE EXCEPTION 'ATTACHMENT_LINKER_DOES_NOT_OWN_ASSET' USING ERRCODE='23514'; END IF;
  IF asset_space IS NOT NULL AND NEW."financial_space_id" IS DISTINCT FROM asset_space THEN
    RAISE EXCEPTION 'ATTACHMENT_ASSET_SPACE_MISMATCH' USING ERRCODE='23514';
  END IF;
  IF (NEW."financial_transaction_id" IS NOT NULL OR NEW."space_background_space_id" IS NOT NULL)
     AND (asset_space IS NULL OR NEW."financial_space_id" IS NULL OR NEW."financial_space_id" IS DISTINCT FROM asset_space) THEN
    RAISE EXCEPTION 'ATTACHMENT_BUSINESS_ASSET_SPACE_REQUIRED' USING ERRCODE='23514';
  END IF;
  IF NEW."financial_space_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "financial_space_memberships" WHERE "financial_space_id"=NEW."financial_space_id"
      AND "user_id"=NEW."linked_by_user_id" AND "status"='ACTIVE'
  ) THEN RAISE EXCEPTION 'ATTACHMENT_LINKER_NOT_ACTIVE_MEMBER' USING ERRCODE='23514'; END IF;
  IF NEW."user_avatar_user_id" IS NOT NULL AND NEW."user_avatar_user_id"<>NEW."linked_by_user_id" THEN
    RAISE EXCEPTION 'ATTACHMENT_AVATAR_OWNER_MISMATCH' USING ERRCODE='23514';
  END IF;
  IF NEW."space_background_space_id" IS NOT NULL AND NEW."financial_space_id" IS DISTINCT FROM NEW."space_background_space_id" THEN
    RAISE EXCEPTION 'ATTACHMENT_BACKGROUND_SPACE_MISMATCH' USING ERRCODE='23514';
  END IF;
  IF NEW."financial_transaction_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "financial_transactions" WHERE "id"=NEW."financial_transaction_id" AND "financial_space_id"=NEW."financial_space_id"
  ) THEN RAISE EXCEPTION 'ATTACHMENT_TRANSACTION_SPACE_MISMATCH' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;

CREATE FUNCTION "v2_validate_temporary_asset_scope"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW."financial_space_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "financial_space_memberships" WHERE "financial_space_id"=NEW."financial_space_id"
      AND "user_id"=NEW."owner_user_id" AND "status"='ACTIVE'
  ) THEN RAISE EXCEPTION 'ASSET_OWNER_NOT_ACTIVE_MEMBER' USING ERRCODE='23514'; END IF;
  IF EXISTS (
    SELECT 1 FROM "attachments" attachment
    WHERE attachment."asset_id"=NEW."id" AND (
      attachment."linked_by_user_id"<>NEW."owner_user_id" OR
      attachment."financial_space_id" IS DISTINCT FROM NEW."financial_space_id"
    )
  ) THEN RAISE EXCEPTION 'ASSET_SCOPE_CHANGE_INVALIDATES_ATTACHMENT' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "temporary_assets_scope_guard" AFTER INSERT OR UPDATE ON "temporary_assets"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "v2_validate_temporary_asset_scope"();

-- Snapshots belong to both a run and an account in exactly the same financial space.
CREATE FUNCTION "v2_validate_balance_snapshot_scope"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "balance_snapshot_runs" run JOIN "ledger_accounts" account ON account."id"=NEW."ledger_account_id"
    WHERE run."id"=NEW."snapshot_run_id" AND run."financial_space_id"=NEW."financial_space_id"
      AND account."financial_space_id"=NEW."financial_space_id" AND run."business_date"=NEW."business_date"
  ) THEN RAISE EXCEPTION 'BALANCE_SNAPSHOT_SCOPE_MISMATCH' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "account_balance_snapshots_scope_guard" AFTER INSERT OR UPDATE ON "account_balance_snapshots"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "v2_validate_balance_snapshot_scope"();

CREATE FUNCTION "v2_guard_balance_snapshot"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE successor "account_balance_snapshots"%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'BALANCE_SNAPSHOT_DELETE_FORBIDDEN' USING ERRCODE='55000'; END IF;
  IF OLD."status"='SUPERSEDED' AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
    RAISE EXCEPTION 'BALANCE_SNAPSHOT_SUPERSESSION_IMMUTABLE' USING ERRCODE='55000';
  END IF;
  IF (to_jsonb(NEW)-ARRAY['status','is_current','superseded_by_id','superseded_at','updated_at']) IS DISTINCT FROM
     (to_jsonb(OLD)-ARRAY['status','is_current','superseded_by_id','superseded_at','updated_at']) THEN
    RAISE EXCEPTION 'BALANCE_SNAPSHOT_FACTS_IMMUTABLE' USING ERRCODE='55000';
  END IF;
  IF (OLD."status",NEW."status") NOT IN (
    ('VALID','VALID'),('VALID','STALE'),('VALID','SUPERSEDED'),('FAILED','FAILED'),('FAILED','REBUILDING'),
    ('STALE','STALE'),('STALE','REBUILDING'),('STALE','SUPERSEDED'),('REBUILDING','REBUILDING'),
    ('REBUILDING','VALID'),('REBUILDING','FAILED'),('REBUILDING','SUPERSEDED'),('SUPERSEDED','SUPERSEDED')
  ) THEN RAISE EXCEPTION 'BALANCE_SNAPSHOT_STATUS_TRANSITION_FORBIDDEN' USING ERRCODE='23514'; END IF;
  IF NEW."status"='SUPERSEDED' THEN
    IF NEW."is_current" OR NEW."superseded_by_id" IS NULL OR NEW."superseded_at" IS NULL
       OR NEW."superseded_by_id"=NEW."id" THEN
      RAISE EXCEPTION 'BALANCE_SNAPSHOT_SUPERSESSION_INVALID' USING ERRCODE='23514';
    END IF;
    SELECT * INTO successor FROM "account_balance_snapshots" WHERE "id"=NEW."superseded_by_id" FOR SHARE;
    IF successor."id" IS NULL OR successor."ledger_account_id"<>NEW."ledger_account_id"
       OR successor."financial_space_id"<>NEW."financial_space_id"
       OR successor."business_date"<>NEW."business_date"
       OR successor."calculation_version"<=NEW."calculation_version"
       OR successor."status"<>'VALID' OR NOT successor."is_current" THEN
      RAISE EXCEPTION 'BALANCE_SNAPSHOT_SUCCESSOR_INVALID' USING ERRCODE='23514';
    END IF;
  ELSIF NEW."superseded_by_id" IS NOT NULL OR NEW."superseded_at" IS NOT NULL THEN
    RAISE EXCEPTION 'BALANCE_SNAPSHOT_SUCCESSOR_METADATA_FORBIDDEN' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "account_balance_snapshots_state_guard" BEFORE UPDATE OR DELETE ON "account_balance_snapshots"
FOR EACH ROW EXECUTE FUNCTION "v2_guard_balance_snapshot"();

CREATE FUNCTION "v2_guard_balance_snapshot_run"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'BALANCE_SNAPSHOT_RUN_DELETE_FORBIDDEN' USING ERRCODE='55000'; END IF;
  IF ROW(NEW."public_id",NEW."financial_space_id",NEW."business_date",NEW."trigger_type",NEW."calculation_version",NEW."idempotency_key",NEW."created_at")
     IS DISTINCT FROM ROW(OLD."public_id",OLD."financial_space_id",OLD."business_date",OLD."trigger_type",OLD."calculation_version",OLD."idempotency_key",OLD."created_at") THEN
    RAISE EXCEPTION 'BALANCE_SNAPSHOT_RUN_IDENTITY_IMMUTABLE' USING ERRCODE='55000';
  END IF;
  IF (OLD."status",NEW."status") NOT IN (
    ('PENDING','PENDING'),('PENDING','RUNNING'),('RUNNING','RUNNING'),('RUNNING','COMPLETED'),
    ('RUNNING','FAILED'),('RUNNING','REQUIRES_REVIEW'),('FAILED','FAILED'),('FAILED','RUNNING'),
    ('REQUIRES_REVIEW','REQUIRES_REVIEW'),('REQUIRES_REVIEW','RUNNING'),('COMPLETED','COMPLETED')
  ) THEN RAISE EXCEPTION 'BALANCE_SNAPSHOT_RUN_STATUS_TRANSITION_FORBIDDEN' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "balance_snapshot_runs_state_guard" BEFORE UPDATE OR DELETE ON "balance_snapshot_runs"
FOR EACH ROW EXECUTE FUNCTION "v2_guard_balance_snapshot_run"();

-- A snapshot interval is exactly one UTC calendar day, including under non-UTC sessions.
ALTER TABLE "account_balance_snapshots" DROP CONSTRAINT "account_balance_snapshots_period_check";
ALTER TABLE "account_balance_snapshots" ADD CONSTRAINT "account_balance_snapshots_period_check" CHECK (
  "period_start_utc" = ("business_date"::timestamp AT TIME ZONE 'UTC') AND
  "period_end_utc" = (("business_date" + 1)::timestamp AT TIME ZONE 'UTC')
);

-- Convert legacy SERIAL defaults to the documented GENERATED ALWAYS identity contract.
DO $$
DECLARE row_record RECORD; old_sequence TEXT; new_sequence TEXT; maximum_id BIGINT;
BEGIN
  FOR row_record IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema='public' AND column_name='id' AND column_default LIKE 'nextval(%'
    ORDER BY table_name
  LOOP
    EXECUTE format('SELECT max(id) FROM public.%I',row_record.table_name) INTO maximum_id;
    old_sequence := pg_get_serial_sequence(format('public.%I',row_record.table_name),'id');
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id DROP DEFAULT',row_record.table_name);
    IF old_sequence IS NOT NULL THEN EXECUTE format('DROP SEQUENCE %s',old_sequence); END IF;
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY',row_record.table_name);
    new_sequence := pg_get_serial_sequence(format('public.%I',row_record.table_name),'id');
    IF maximum_id IS NOT NULL THEN PERFORM setval(new_sequence,maximum_id,true); END IF;
  END LOOP;
END $$;
