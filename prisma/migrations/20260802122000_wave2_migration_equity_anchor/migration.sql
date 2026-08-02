-- Wave 2 corrective guard: MIGRATION_EQUITY is usable only through an audited anchor.
ALTER TABLE "migration_anchor_details" ALTER COLUMN "discrepancy_case_id" SET NOT NULL;
ALTER TABLE "migration_anchor_details" ADD CONSTRAINT "migration_anchor_approval_reason_check" CHECK (length(btrim("approval_reason")) > 0);

CREATE FUNCTION "v2_validate_migration_anchor_for_transaction"(transaction_id BIGINT) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  transaction_row "financial_transactions"%ROWTYPE;
  template_code VARCHAR(64);
  opening_count BIGINT;
  migration_count BIGINT;
  anchor_count BIGINT;
  account_entry "ledger_entries"%ROWTYPE;
  anchor_row "migration_anchor_details"%ROWTYPE;
  run_checksum CHAR(64);
  run_status "migration_run_status";
  discrepancy_run_id BIGINT;
  discrepancy_space_id BIGINT;
  discrepancy_status_value "discrepancy_status";
  discrepancy_severity_value "discrepancy_severity";
  discrepancy_resolution_action VARCHAR(96);
  discrepancy_evidence JSONB;
BEGIN
  SELECT * INTO transaction_row FROM "financial_transactions" WHERE "id" = transaction_id;
  IF NOT FOUND OR transaction_row."type" = 'REVERSAL' THEN RETURN; END IF;
  SELECT "semantic_rule_code" INTO template_code FROM "posting_template_definitions"
  WHERE "id" = transaction_row."posting_template_definition_id";

  SELECT count(*) FILTER (WHERE "entry_role" = 'OPENING_EQUITY'),
         count(*) FILTER (WHERE "entry_role" = 'MIGRATION_EQUITY')
  INTO opening_count, migration_count
  FROM "ledger_entries" WHERE "financial_transaction_id" = transaction_id;
  SELECT count(*) INTO anchor_count FROM "migration_anchor_details" WHERE "financial_transaction_id" = transaction_id;

  IF template_code <> 'OPENING_BALANCE' THEN
    IF migration_count <> 0 OR anchor_count <> 0 THEN
      RAISE EXCEPTION 'MIGRATION_ANCHOR_REQUIRES_OPENING_TEMPLATE' USING ERRCODE = '23514';
    END IF;
    RETURN;
  END IF;

  IF transaction_row."amount" = 0 THEN
    IF opening_count <> 0 OR migration_count <> 0 OR anchor_count <> 0 THEN
      RAISE EXCEPTION 'ZERO_OPENING_CANNOT_USE_EQUITY_OR_ANCHOR' USING ERRCODE = '23514';
    END IF;
    RETURN;
  END IF;

  IF opening_count = 1 AND migration_count = 0 THEN
    IF anchor_count <> 0 THEN
      RAISE EXCEPTION 'NORMAL_OPENING_CANNOT_HAVE_MIGRATION_ANCHOR' USING ERRCODE = '23514';
    END IF;
    RETURN;
  END IF;

  IF opening_count <> 0 OR migration_count <> 1 OR anchor_count <> 1 THEN
    RAISE EXCEPTION 'OPENING_EQUITY_ROLE_XOR_REQUIRED' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO account_entry FROM "ledger_entries"
  WHERE "financial_transaction_id" = transaction_id AND "entry_role" = 'ACCOUNT';
  SELECT * INTO anchor_row FROM "migration_anchor_details" WHERE "financial_transaction_id" = transaction_id;
  SELECT "source_checksum", "status" INTO run_checksum, run_status
  FROM "migration_runs" WHERE "id" = anchor_row."migration_run_id";
  SELECT "migration_run_id", "financial_space_id", "status", "severity", "resolution_action", "evidence"
  INTO discrepancy_run_id, discrepancy_space_id, discrepancy_status_value, discrepancy_severity_value,
       discrepancy_resolution_action, discrepancy_evidence
  FROM "discrepancy_cases" WHERE "id" = anchor_row."discrepancy_case_id";

  IF account_entry."id" IS NULL OR
     anchor_row."ledger_account_id" <> account_entry."ledger_account_id" OR
     anchor_row."difference_amount" <> account_entry."amount" OR
     transaction_row."amount" <> anchor_row."difference_amount" OR
     anchor_row."source_checksum" <> run_checksum OR
     run_status NOT IN ('RUNNING', 'COMPLETED') OR
     discrepancy_run_id IS DISTINCT FROM anchor_row."migration_run_id" OR
     discrepancy_space_id IS DISTINCT FROM transaction_row."financial_space_id" OR
     discrepancy_status_value <> 'RESOLVED' OR
     discrepancy_severity_value <> 'BLOCKING' OR
     discrepancy_resolution_action IS DISTINCT FROM 'MIGRATION_EQUITY_APPROVED' OR
     discrepancy_evidence IS NULL OR discrepancy_evidence = '{}'::jsonb OR
     length(btrim(anchor_row."approval_reason")) = 0 OR
     anchor_row."approved_at" > transaction_timestamp() THEN
    RAISE EXCEPTION 'MIGRATION_ANCHOR_EVIDENCE_MISMATCH' USING ERRCODE = '23514';
  END IF;
END $$;

CREATE FUNCTION "v2_validate_migration_anchor_trigger"() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM "v2_validate_migration_anchor_for_transaction"(NEW."id");
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER "financial_transactions_migration_anchor_guard"
AFTER INSERT OR UPDATE ON "financial_transactions"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "v2_validate_migration_anchor_trigger"();

CREATE FUNCTION "v2_validate_migration_anchor_row_trigger"() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM "v2_validate_migration_anchor_for_transaction"(NEW."financial_transaction_id");
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER "migration_anchor_details_evidence_guard"
AFTER INSERT OR UPDATE ON "migration_anchor_details"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "v2_validate_migration_anchor_row_trigger"();

CREATE FUNCTION "v2_reject_migration_anchor_change"() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'MIGRATION_ANCHOR_IMMUTABLE' USING ERRCODE = '55000';
END $$;

CREATE TRIGGER "migration_anchor_details_immutable"
BEFORE UPDATE OR DELETE ON "migration_anchor_details"
FOR EACH ROW EXECUTE FUNCTION "v2_reject_migration_anchor_change"();

