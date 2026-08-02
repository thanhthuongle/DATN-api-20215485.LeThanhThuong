-- Wave 2 corrective guard: ledger entries and cached projections advance atomically.
CREATE OR REPLACE FUNCTION "v2_prepare_ledger_entry"() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  transaction_row "financial_transactions"%ROWTYPE;
  account_row "ledger_accounts"%ROWTYPE;
  next_balance BIGINT;
BEGIN
  SELECT * INTO transaction_row
  FROM "financial_transactions"
  WHERE "id" = NEW."financial_transaction_id"
  FOR UPDATE;

  IF NOT FOUND OR transaction_row."status" <> 'DRAFT' THEN
    RAISE EXCEPTION 'LEDGER_ENTRY_REQUIRES_DRAFT_TRANSACTION' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO account_row
  FROM "ledger_accounts"
  WHERE "id" = NEW."ledger_account_id"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEDGER_ACCOUNT_NOT_FOUND' USING ERRCODE = '23503';
  END IF;
  IF account_row."status" <> 'ACTIVE' THEN
    RAISE EXCEPTION 'LEDGER_ACCOUNT_NOT_ACTIVE' USING ERRCODE = '23514';
  END IF;
  IF account_row."financial_space_id" IS DISTINCT FROM transaction_row."financial_space_id" THEN
    RAISE EXCEPTION 'LEDGER_ENTRY_SPACE_MISMATCH' USING ERRCODE = '23514';
  END IF;

  next_balance := account_row."current_balance" + NEW."amount";
  IF NOT account_row."allows_negative_balance" AND next_balance < 0 THEN
    RAISE EXCEPTION 'LEDGER_NEGATIVE_BALANCE_FORBIDDEN' USING ERRCODE = '23514';
  END IF;

  -- Caller values are never authoritative. The locked account projection owns the chain.
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

