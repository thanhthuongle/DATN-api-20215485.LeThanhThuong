-- Wave 2 corrective guard: sanitized migration source evidence is immutable and terminal states are one-way.
ALTER TABLE "migration_source_records" ADD COLUMN "sanitized_document_hash" CHAR(64);
ALTER TABLE "migration_source_records" ADD COLUMN "sanitization_policy_version" VARCHAR(32) NOT NULL DEFAULT 'migration-redaction-v1';
ALTER TABLE "migration_source_records" ADD COLUMN "redaction_manifest" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE "migration_source_records"
SET "sanitized_document_hash" = encode(digest(convert_to("raw_document"::text, 'UTF8'), 'sha256'), 'hex'),
    "redaction_manifest" = CASE
      WHEN "raw_document"->>'password' = '[REDACTED]' THEN jsonb_build_array('$.password')
      ELSE "redaction_manifest"
    END;

ALTER TABLE "migration_source_records" ALTER COLUMN "sanitized_document_hash" SET NOT NULL;
ALTER TABLE "migration_source_records" ADD CONSTRAINT "migration_source_records_hash_check" CHECK (
  "source_hash" ~ '^[0-9a-f]{64}$' AND "sanitized_document_hash" ~ '^[0-9a-f]{64}$'
);
ALTER TABLE "migration_source_records" ADD CONSTRAINT "migration_source_records_sanitization_check" CHECK (
  length(btrim("sanitization_policy_version")) > 0 AND jsonb_typeof("redaction_manifest") = 'array'
);
ALTER TABLE "migration_source_records" ADD CONSTRAINT "migration_source_records_disposition_check" CHECK (
  ("disposition" = 'STAGED' AND "target_type" IS NULL AND "target_public_id" IS NULL AND "reject_code" IS NULL AND "processed_at" IS NULL) OR
  ("disposition" = 'LOADED' AND "target_type" IS NOT NULL AND "target_public_id" IS NOT NULL AND "reject_code" IS NULL AND "processed_at" IS NOT NULL) OR
  ("disposition" = 'ARCHIVED' AND "target_type" = 'ARCHIVE_ONLY' AND "target_public_id" IS NULL AND "reject_code" IS NULL AND "processed_at" IS NOT NULL) OR
  ("disposition" = 'REJECTED' AND "target_type" IS NULL AND "target_public_id" IS NULL AND "reject_code" IS NOT NULL AND "processed_at" IS NOT NULL)
);

CREATE FUNCTION "v2_guard_migration_source_record"() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'MIGRATION_SOURCE_RECORD_DELETE_FORBIDDEN' USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW."sanitized_document_hash" := encode(digest(convert_to(NEW."raw_document"::text, 'UTF8'), 'sha256'), 'hex');
    RETURN NEW;
  END IF;

  IF ROW(NEW."migration_run_id", NEW."source_collection", NEW."source_legacy_id", NEW."source_hash",
         NEW."raw_document", NEW."sanitized_document_hash", NEW."sanitization_policy_version",
         NEW."redaction_manifest", NEW."created_at")
     IS DISTINCT FROM
     ROW(OLD."migration_run_id", OLD."source_collection", OLD."source_legacy_id", OLD."source_hash",
         OLD."raw_document", OLD."sanitized_document_hash", OLD."sanitization_policy_version",
         OLD."redaction_manifest", OLD."created_at") THEN
    RAISE EXCEPTION 'MIGRATION_SOURCE_EVIDENCE_IMMUTABLE' USING ERRCODE = '55000';
  END IF;

  IF OLD."disposition" <> 'STAGED' AND
     ROW(NEW."disposition", NEW."target_type", NEW."target_public_id", NEW."reject_code", NEW."processed_at")
     IS DISTINCT FROM
     ROW(OLD."disposition", OLD."target_type", OLD."target_public_id", OLD."reject_code", OLD."processed_at") THEN
    RAISE EXCEPTION 'MIGRATION_SOURCE_DISPOSITION_TERMINAL' USING ERRCODE = '23514';
  END IF;

  IF OLD."disposition" = 'STAGED' AND NEW."disposition" NOT IN ('STAGED', 'LOADED', 'ARCHIVED', 'REJECTED') THEN
    RAISE EXCEPTION 'MIGRATION_SOURCE_DISPOSITION_TRANSITION_INVALID' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER "migration_source_records_evidence_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "migration_source_records"
FOR EACH ROW EXECUTE FUNCTION "v2_guard_migration_source_record"();
