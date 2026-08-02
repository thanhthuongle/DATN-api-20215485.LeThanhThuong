-- Wave 2 corrective guard: bind immutable templates to transaction types and posting semantics.
ALTER TABLE "posting_template_definitions" ADD COLUMN "transaction_type" "financial_transaction_type";
ALTER TABLE "posting_template_definitions" ADD COLUMN "semantic_rule_code" VARCHAR(64);

UPDATE "posting_template_definitions"
SET "transaction_type" = CASE "code"
  WHEN 'OPENING_BALANCE' THEN 'ACCOUNT_OPENING'::"financial_transaction_type"
  WHEN 'ACCUMULATION_OPENING' THEN 'ACCUMULATION_OPENING'::"financial_transaction_type"
  WHEN 'INCOME' THEN 'INCOME'::"financial_transaction_type"
  WHEN 'EXPENSE' THEN 'EXPENSE'::"financial_transaction_type"
  WHEN 'TRANSFER' THEN 'TRANSFER'::"financial_transaction_type"
  WHEN 'CONTRIBUTION_OUT' THEN 'CONTRIBUTION'::"financial_transaction_type"
  WHEN 'CONTRIBUTION_IN' THEN 'CONTRIBUTION'::"financial_transaction_type"
  WHEN 'LOAN_DISBURSEMENT' THEN 'LOAN_DISBURSEMENT'::"financial_transaction_type"
  WHEN 'BORROWING' THEN 'BORROWING'::"financial_transaction_type"
  WHEN 'REPAYMENT' THEN 'REPAYMENT'::"financial_transaction_type"
  WHEN 'COLLECTION' THEN 'COLLECTION'::"financial_transaction_type"
  WHEN 'ACCUMULATION_CLOSE' THEN 'ACCUMULATION_CLOSE'::"financial_transaction_type"
  WHEN 'SAVING_DEPOSIT' THEN 'SAVING_DEPOSIT'::"financial_transaction_type"
  WHEN 'SAVING_INTEREST_MONTHLY' THEN 'SAVING_INTEREST_MONTHLY'::"financial_transaction_type"
  WHEN 'SAVING_INTEREST_MATURITY' THEN 'SAVING_INTEREST_MATURITY'::"financial_transaction_type"
  WHEN 'SAVING_CLOSE' THEN 'SAVING_CLOSE'::"financial_transaction_type"
  WHEN 'SAVING_ROLLOVER_PRINCIPAL' THEN 'SAVING_ROLLOVER_PRINCIPAL'::"financial_transaction_type"
  WHEN 'SAVING_ROLLOVER_PRINCIPAL_INTEREST' THEN 'SAVING_ROLLOVER_PRINCIPAL_INTEREST'::"financial_transaction_type"
END,
"semantic_rule_code" = "code";

ALTER TABLE "posting_template_definitions" ALTER COLUMN "transaction_type" SET NOT NULL;
ALTER TABLE "posting_template_definitions" ALTER COLUMN "semantic_rule_code" SET NOT NULL;
ALTER TABLE "posting_template_definitions" ADD CONSTRAINT "posting_template_semantic_rule_check" CHECK (length(btrim("semantic_rule_code")) > 0);
CREATE INDEX "posting_template_definitions_transaction_type_idx" ON "posting_template_definitions"("transaction_type", "status");

CREATE FUNCTION "v2_entry_matches"(
  transaction_id BIGINT,
  role_code VARCHAR,
  expected_amount BIGINT,
  expected_account_id BIGINT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT count(*) = 1
    AND coalesce(bool_and(
      entry."amount" = expected_amount
      AND (expected_account_id IS NULL OR entry."ledger_account_id" = expected_account_id)
    ), false)
  FROM "ledger_entries" entry
  WHERE entry."financial_transaction_id" = transaction_id
    AND entry."entry_role" = role_code;
$$;

CREATE FUNCTION "v2_validate_posting_semantics"(transaction_id BIGINT) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  transaction_row "financial_transactions"%ROWTYPE;
  template_row "posting_template_definitions"%ROWTYPE;
  income_detail "transaction_income_details"%ROWTYPE;
  expense_detail "transaction_expense_details"%ROWTYPE;
  transfer_detail "transaction_transfer_details"%ROWTYPE;
  debt_detail "debt_agreements"%ROWTYPE;
  settlement_detail "debt_settlements"%ROWTYPE;
  saving_detail "transaction_saving_details"%ROWTYPE;
  detail_count BIGINT;
  group_count BIGINT;
  saving_ledger_id BIGINT;
  optional_pair_count BIGINT;
BEGIN
  SELECT * INTO transaction_row FROM "financial_transactions" WHERE "id" = transaction_id;
  SELECT * INTO template_row FROM "posting_template_definitions" WHERE "id" = transaction_row."posting_template_definition_id";

  IF transaction_row."type" = 'REVERSAL' THEN
    RETURN;
  END IF;
  IF template_row."transaction_type" IS DISTINCT FROM transaction_row."type" THEN
    RAISE EXCEPTION 'TRANSACTION_TEMPLATE_TYPE_MISMATCH' USING ERRCODE = '23514';
  END IF;

  SELECT
    (SELECT count(*) FROM "transaction_income_details" WHERE "financial_transaction_id" = transaction_id) +
    (SELECT count(*) FROM "transaction_expense_details" WHERE "financial_transaction_id" = transaction_id) +
    (SELECT count(*) FROM "transaction_transfer_details" WHERE "financial_transaction_id" = transaction_id) +
    (SELECT count(*) FROM "debt_agreements" WHERE "origin_transaction_id" = transaction_id) +
    (SELECT count(*) FROM "debt_settlements" WHERE "financial_transaction_id" = transaction_id) +
    (SELECT count(*) FROM "transaction_saving_details" WHERE "financial_transaction_id" = transaction_id) +
    (SELECT count(*) FROM "migration_anchor_details" WHERE "financial_transaction_id" = transaction_id)
  INTO detail_count;

  CASE template_row."semantic_rule_code"
    WHEN 'OPENING_BALANCE' THEN
      IF transaction_row."amount" = 0 THEN
        IF detail_count <> 0 OR EXISTS (SELECT 1 FROM "ledger_entries" WHERE "financial_transaction_id" = transaction_id) THEN
          RAISE EXCEPTION 'ZERO_OPENING_MUST_NOT_POST' USING ERRCODE = '23514';
        END IF;
      ELSIF detail_count > 1 OR
        NOT "v2_entry_matches"(transaction_id, 'ACCOUNT', transaction_row."amount") OR
        NOT (
          "v2_entry_matches"(transaction_id, 'OPENING_EQUITY', -transaction_row."amount") OR
          "v2_entry_matches"(transaction_id, 'MIGRATION_EQUITY', -transaction_row."amount")
        ) THEN
        RAISE EXCEPTION 'OPENING_POSTING_AMOUNT_MISMATCH' USING ERRCODE = '23514';
      END IF;

    WHEN 'ACCUMULATION_OPENING' THEN
      IF transaction_row."amount" <> 0 OR detail_count <> 0 OR EXISTS (SELECT 1 FROM "ledger_entries" WHERE "financial_transaction_id" = transaction_id) THEN
        RAISE EXCEPTION 'ACCUMULATION_OPENING_MUST_NOT_POST' USING ERRCODE = '23514';
      END IF;

    WHEN 'INCOME' THEN
      SELECT * INTO income_detail FROM "transaction_income_details" WHERE "financial_transaction_id" = transaction_id;
      IF detail_count <> 1 OR NOT FOUND OR
        NOT "v2_entry_matches"(transaction_id, 'TARGET', transaction_row."amount", income_detail."target_ledger_account_id") OR
        NOT "v2_entry_matches"(transaction_id, 'INCOME_CLEARING', -transaction_row."amount") THEN
        RAISE EXCEPTION 'INCOME_POSTING_SEMANTICS_MISMATCH' USING ERRCODE = '23514';
      END IF;

    WHEN 'EXPENSE' THEN
      SELECT * INTO expense_detail FROM "transaction_expense_details" WHERE "financial_transaction_id" = transaction_id;
      IF detail_count <> 1 OR NOT FOUND OR
        NOT "v2_entry_matches"(transaction_id, 'SOURCE', -transaction_row."amount", expense_detail."source_ledger_account_id") OR
        NOT "v2_entry_matches"(transaction_id, 'EXPENSE_CLEARING', transaction_row."amount") THEN
        RAISE EXCEPTION 'EXPENSE_POSTING_SEMANTICS_MISMATCH' USING ERRCODE = '23514';
      END IF;

    WHEN 'TRANSFER', 'ACCUMULATION_CLOSE' THEN
      SELECT * INTO transfer_detail FROM "transaction_transfer_details" WHERE "financial_transaction_id" = transaction_id;
      IF detail_count <> 1 OR NOT FOUND OR
        NOT "v2_entry_matches"(transaction_id,
          CASE WHEN template_row."semantic_rule_code" = 'TRANSFER' THEN 'SOURCE' ELSE 'ACCUMULATION_SOURCE' END,
          -transaction_row."amount", transfer_detail."source_ledger_account_id") OR
        NOT "v2_entry_matches"(transaction_id, 'TARGET', transaction_row."amount", transfer_detail."target_ledger_account_id") THEN
        RAISE EXCEPTION 'TRANSFER_POSTING_SEMANTICS_MISMATCH' USING ERRCODE = '23514';
      END IF;

    WHEN 'CONTRIBUTION_OUT' THEN
      SELECT count(*) INTO group_count FROM "interspace_transfer_groups"
      WHERE "source_transaction_id" = transaction_id
        AND "amount" = transaction_row."amount"
        AND "source_financial_space_id" = transaction_row."financial_space_id";
      IF detail_count <> 0 OR group_count <> 1 OR
        NOT "v2_entry_matches"(transaction_id, 'SOURCE', -transaction_row."amount") OR
        NOT "v2_entry_matches"(transaction_id, 'INTERSPACE_CLEARING_OUT', transaction_row."amount") THEN
        RAISE EXCEPTION 'CONTRIBUTION_OUT_POSTING_SEMANTICS_MISMATCH' USING ERRCODE = '23514';
      END IF;

    WHEN 'CONTRIBUTION_IN' THEN
      SELECT count(*) INTO group_count FROM "interspace_transfer_groups"
      WHERE "target_transaction_id" = transaction_id
        AND "amount" = transaction_row."amount"
        AND "target_financial_space_id" = transaction_row."financial_space_id";
      IF detail_count <> 0 OR group_count <> 1 OR
        NOT "v2_entry_matches"(transaction_id, 'INTERSPACE_CLEARING_IN', -transaction_row."amount") OR
        NOT "v2_entry_matches"(transaction_id, 'TARGET', transaction_row."amount") THEN
        RAISE EXCEPTION 'CONTRIBUTION_IN_POSTING_SEMANTICS_MISMATCH' USING ERRCODE = '23514';
      END IF;

    WHEN 'LOAN_DISBURSEMENT', 'BORROWING' THEN
      SELECT * INTO debt_detail FROM "debt_agreements" WHERE "origin_transaction_id" = transaction_id;
      IF detail_count <> 1 OR NOT FOUND OR debt_detail."principal_amount" <> transaction_row."amount" OR
        debt_detail."financial_space_id" <> transaction_row."financial_space_id" OR
        (template_row."semantic_rule_code" = 'LOAN_DISBURSEMENT' AND (
          debt_detail."direction" <> 'RECEIVABLE' OR
          NOT "v2_entry_matches"(transaction_id, 'CASH_SOURCE', -transaction_row."amount", debt_detail."cash_ledger_account_id") OR
          NOT "v2_entry_matches"(transaction_id, 'LOAN_RECEIVABLE', transaction_row."amount", debt_detail."debt_ledger_account_id")
        )) OR
        (template_row."semantic_rule_code" = 'BORROWING' AND (
          debt_detail."direction" <> 'PAYABLE' OR
          NOT "v2_entry_matches"(transaction_id, 'CASH_TARGET', transaction_row."amount", debt_detail."cash_ledger_account_id") OR
          NOT "v2_entry_matches"(transaction_id, 'BORROWING_LIABILITY', -transaction_row."amount", debt_detail."debt_ledger_account_id")
        )) THEN
        RAISE EXCEPTION 'DEBT_ORIGIN_POSTING_SEMANTICS_MISMATCH' USING ERRCODE = '23514';
      END IF;

    WHEN 'REPAYMENT', 'COLLECTION' THEN
      SELECT * INTO settlement_detail FROM "debt_settlements" WHERE "financial_transaction_id" = transaction_id;
      SELECT debt.* INTO debt_detail FROM "debt_agreements" debt
      JOIN "debt_settlements" settlement ON settlement."debt_agreement_id" = debt."id"
      WHERE settlement."financial_transaction_id" = transaction_id;
      IF detail_count <> 1 OR NOT FOUND OR settlement_detail."principal_amount" <> transaction_row."amount" OR
        settlement_detail."interest_amount" <> 0 OR
        (template_row."semantic_rule_code" = 'REPAYMENT' AND (
          debt_detail."direction" <> 'PAYABLE' OR
          NOT "v2_entry_matches"(transaction_id, 'CASH_SOURCE', -transaction_row."amount", settlement_detail."cash_ledger_account_id") OR
          NOT "v2_entry_matches"(transaction_id, 'BORROWING_LIABILITY', transaction_row."amount", debt_detail."debt_ledger_account_id")
        )) OR
        (template_row."semantic_rule_code" = 'COLLECTION' AND (
          debt_detail."direction" <> 'RECEIVABLE' OR
          NOT "v2_entry_matches"(transaction_id, 'CASH_TARGET', transaction_row."amount", settlement_detail."cash_ledger_account_id") OR
          NOT "v2_entry_matches"(transaction_id, 'LOAN_RECEIVABLE', -transaction_row."amount", debt_detail."debt_ledger_account_id")
        )) THEN
        RAISE EXCEPTION 'DEBT_SETTLEMENT_POSTING_SEMANTICS_MISMATCH' USING ERRCODE = '23514';
      END IF;

    WHEN 'SAVING_DEPOSIT', 'SAVING_INTEREST_MONTHLY', 'SAVING_INTEREST_MATURITY', 'SAVING_CLOSE',
         'SAVING_ROLLOVER_PRINCIPAL', 'SAVING_ROLLOVER_PRINCIPAL_INTEREST' THEN
      SELECT * INTO saving_detail FROM "transaction_saving_details" WHERE "financial_transaction_id" = transaction_id;
      SELECT "id" INTO saving_ledger_id FROM "ledger_accounts" WHERE "saving_account_id" = saving_detail."saving_account_id";
      IF detail_count <> 1 OR NOT FOUND THEN
        RAISE EXCEPTION 'SAVING_DETAIL_REQUIRED' USING ERRCODE = '23514';
      END IF;

      IF template_row."semantic_rule_code" = 'SAVING_DEPOSIT' AND (
        saving_detail."action" <> 'DEPOSIT' OR saving_detail."principal_amount" <> transaction_row."amount" OR saving_detail."interest_amount" <> 0 OR
        NOT "v2_entry_matches"(transaction_id, 'SOURCE', -transaction_row."amount", saving_detail."source_ledger_account_id") OR
        NOT "v2_entry_matches"(transaction_id, 'SAVING_TARGET', transaction_row."amount", saving_ledger_id)
      ) THEN RAISE EXCEPTION 'SAVING_DEPOSIT_POSTING_SEMANTICS_MISMATCH' USING ERRCODE = '23514'; END IF;

      IF template_row."semantic_rule_code" IN ('SAVING_INTEREST_MONTHLY', 'SAVING_INTEREST_MATURITY') THEN
        IF saving_detail."interest_amount" <> transaction_row."amount" OR
          (template_row."semantic_rule_code" = 'SAVING_INTEREST_MONTHLY' AND saving_detail."action" <> 'MONTHLY_INTEREST') OR
          (template_row."semantic_rule_code" = 'SAVING_INTEREST_MATURITY' AND saving_detail."action" <> 'MATURITY_INTEREST') OR
          NOT "v2_entry_matches"(transaction_id, 'INTEREST_EXPENSE', -transaction_row."amount") OR
          NOT "v2_entry_matches"(transaction_id, 'SAVING_INTEREST_CREDIT', transaction_row."amount", saving_ledger_id) THEN
          RAISE EXCEPTION 'SAVING_INTEREST_POSTING_SEMANTICS_MISMATCH' USING ERRCODE = '23514';
        END IF;
        SELECT count(*) INTO optional_pair_count FROM "ledger_entries"
        WHERE "financial_transaction_id" = transaction_id AND "entry_role" IN ('SAVING_PAYOUT', 'INTEREST_TARGET');
        IF (template_row."semantic_rule_code" = 'SAVING_INTEREST_MONTHLY' AND optional_pair_count <> 2) OR
          (template_row."semantic_rule_code" = 'SAVING_INTEREST_MATURITY' AND optional_pair_count NOT IN (0, 2)) OR
          (optional_pair_count = 2 AND (
            NOT "v2_entry_matches"(transaction_id, 'SAVING_PAYOUT', -transaction_row."amount", saving_ledger_id) OR
            NOT "v2_entry_matches"(transaction_id, 'INTEREST_TARGET', transaction_row."amount", saving_detail."target_ledger_account_id")
          )) THEN
          RAISE EXCEPTION 'SAVING_INTEREST_PAYOUT_SEMANTICS_MISMATCH' USING ERRCODE = '23514';
        END IF;
      END IF;

      IF template_row."semantic_rule_code" = 'SAVING_CLOSE' THEN
        IF saving_detail."action" <> 'CLOSE' OR transaction_row."amount" <> saving_detail."principal_amount" + saving_detail."interest_amount" OR
          NOT "v2_entry_matches"(transaction_id, 'SAVING_SOURCE', -transaction_row."amount", saving_ledger_id) OR
          NOT "v2_entry_matches"(transaction_id, 'TARGET', transaction_row."amount", saving_detail."target_ledger_account_id") THEN
          RAISE EXCEPTION 'SAVING_CLOSE_POSTING_SEMANTICS_MISMATCH' USING ERRCODE = '23514';
        END IF;
        SELECT count(*) INTO optional_pair_count FROM "ledger_entries"
        WHERE "financial_transaction_id" = transaction_id AND "entry_role" IN ('INTEREST_EXPENSE', 'SAVING_INTEREST_CREDIT');
        IF (saving_detail."interest_amount" = 0 AND optional_pair_count <> 0) OR
          (saving_detail."interest_amount" > 0 AND (
            optional_pair_count <> 2 OR
            NOT "v2_entry_matches"(transaction_id, 'INTEREST_EXPENSE', -saving_detail."interest_amount") OR
            NOT "v2_entry_matches"(transaction_id, 'SAVING_INTEREST_CREDIT', saving_detail."interest_amount", saving_ledger_id)
          )) THEN
          RAISE EXCEPTION 'SAVING_CLOSE_INTEREST_SEMANTICS_MISMATCH' USING ERRCODE = '23514';
        END IF;
      END IF;

      IF template_row."semantic_rule_code" = 'SAVING_ROLLOVER_PRINCIPAL' AND (
        saving_detail."action" <> 'ROLLOVER_PRINCIPAL' OR saving_detail."principal_amount" <> transaction_row."amount" OR saving_detail."interest_amount" <> 0 OR
        NOT "v2_entry_matches"(transaction_id, 'OLD_SAVING', -transaction_row."amount", saving_ledger_id) OR
        NOT "v2_entry_matches"(transaction_id, 'NEW_SAVING', transaction_row."amount", saving_detail."target_ledger_account_id")
      ) THEN RAISE EXCEPTION 'SAVING_ROLLOVER_PRINCIPAL_SEMANTICS_MISMATCH' USING ERRCODE = '23514'; END IF;

      IF template_row."semantic_rule_code" = 'SAVING_ROLLOVER_PRINCIPAL_INTEREST' AND (
        saving_detail."action" <> 'ROLLOVER_PRINCIPAL_INTEREST' OR transaction_row."amount" <> saving_detail."principal_amount" + saving_detail."interest_amount" OR
        saving_detail."interest_amount" <= 0 OR
        NOT "v2_entry_matches"(transaction_id, 'INTEREST_EXPENSE', -saving_detail."interest_amount") OR
        NOT "v2_entry_matches"(transaction_id, 'OLD_SAVING_INTEREST_CREDIT', saving_detail."interest_amount", saving_ledger_id) OR
        NOT "v2_entry_matches"(transaction_id, 'OLD_SAVING', -transaction_row."amount", saving_ledger_id) OR
        NOT "v2_entry_matches"(transaction_id, 'NEW_SAVING', transaction_row."amount", saving_detail."target_ledger_account_id")
      ) THEN RAISE EXCEPTION 'SAVING_ROLLOVER_INTEREST_SEMANTICS_MISMATCH' USING ERRCODE = '23514'; END IF;

    ELSE
      RAISE EXCEPTION 'UNKNOWN_POSTING_SEMANTIC_RULE %', template_row."semantic_rule_code" USING ERRCODE = '23514';
  END CASE;
END $$;

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
  IF current_row."status" = 'DRAFT' THEN
    RAISE EXCEPTION 'DRAFT_TRANSACTION_CANNOT_SURVIVE_COMMIT' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO template_row FROM "posting_template_definitions" WHERE "id" = current_row."posting_template_definition_id";
  SELECT count(*), coalesce(sum("amount"), 0) INTO entry_count, entry_sum
    FROM "ledger_entries" WHERE "financial_transaction_id" = current_row."id";
  permits_no_posting :=
    (template_row."semantic_rule_code" = 'OPENING_BALANCE' AND current_row."amount" = 0) OR
    (template_row."semantic_rule_code" = 'ACCUMULATION_OPENING' AND current_row."amount" = 0);
  IF (permits_no_posting AND entry_count <> 0) OR (NOT permits_no_posting AND entry_count < 2) OR entry_sum <> 0 THEN
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
  IF current_row."type" <> 'REVERSAL' AND NOT permits_no_posting AND EXISTS (
    SELECT 1 FROM "posting_template_entry_roles" r
    LEFT JOIN "ledger_entries" e ON e."financial_transaction_id" = current_row."id" AND e."entry_role" = r."entry_role"
    WHERE r."posting_template_definition_id" = current_row."posting_template_definition_id"
    GROUP BY r."id", r."minimum_occurrences", r."maximum_occurrences"
    HAVING count(e."id") < r."minimum_occurrences" OR count(e."id") > r."maximum_occurrences"
  ) THEN
    RAISE EXCEPTION 'POSTED_TRANSACTION_TEMPLATE_CARDINALITY_MISMATCH' USING ERRCODE = '23514';
  END IF;
  PERFORM "v2_validate_posting_semantics"(current_row."id");
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

CREATE FUNCTION "v2_guard_posting_template_definition"() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'POSTING_TEMPLATE_DEFINITION_DELETE_FORBIDDEN' USING ERRCODE = '55000';
  END IF;
  IF ROW(NEW."public_id", NEW."code", NEW."version", NEW."transaction_type", NEW."semantic_rule_code",
         NEW."definition_hash", NEW."effective_at", NEW."created_at")
     IS DISTINCT FROM
     ROW(OLD."public_id", OLD."code", OLD."version", OLD."transaction_type", OLD."semantic_rule_code",
         OLD."definition_hash", OLD."effective_at", OLD."created_at") THEN
    RAISE EXCEPTION 'POSTING_TEMPLATE_DEFINITION_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  IF OLD."status" = 'RETIRED' OR
     (OLD."status" = 'APPROVED' AND NEW."status" NOT IN ('APPROVED', 'RETIRED')) THEN
    RAISE EXCEPTION 'POSTING_TEMPLATE_STATUS_TRANSITION_FORBIDDEN' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "posting_template_definitions_immutable"
BEFORE UPDATE OR DELETE ON "posting_template_definitions"
FOR EACH ROW EXECUTE FUNCTION "v2_guard_posting_template_definition"();

