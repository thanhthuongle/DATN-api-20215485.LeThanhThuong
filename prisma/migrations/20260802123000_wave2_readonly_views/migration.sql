-- Wave 2 corrective security boundary: readonly consumers use payload-safe views only.
CREATE VIEW "v2_readonly_financial_transactions" AS
SELECT transaction."public_id",
       space."public_id" AS "financial_space_public_id",
       transaction."type",
       transaction."status",
       transaction."name",
       transaction."amount",
       transaction."occurred_at",
       transaction."posted_at",
       transaction."created_at"
FROM "financial_transactions" transaction
JOIN "financial_spaces" space ON space."id" = transaction."financial_space_id";

CREATE VIEW "v2_readonly_ledger_accounts" AS
SELECT account."public_id",
       space."public_id" AS "financial_space_public_id",
       account."kind",
       account."normal_side",
       account."system_role",
       account."name",
       account."current_balance",
       account."current_sequence",
       account."status",
       account."created_at",
       account."updated_at"
FROM "ledger_accounts" account
JOIN "financial_spaces" space ON space."id" = account."financial_space_id";

CREATE VIEW "v2_readonly_migration_runs" AS
SELECT "public_id", "run_type", "source_snapshot_id", "mapping_version", "schema_version", "status",
       "source_count", "loaded_count", "rejected_count", "started_at", "completed_at", "created_at", "updated_at"
FROM "migration_runs";

CREATE VIEW "v2_readonly_discrepancy_summary" AS
SELECT "public_id", "source", "type", "severity", "status", "resource_type", "resource_public_id",
       "detected_at", "resolved_at", "created_at", "updated_at"
FROM "discrepancy_cases";

REVOKE ALL ON "v2_readonly_financial_transactions" FROM PUBLIC;
REVOKE ALL ON "v2_readonly_ledger_accounts" FROM PUBLIC;
REVOKE ALL ON "v2_readonly_migration_runs" FROM PUBLIC;
REVOKE ALL ON "v2_readonly_discrepancy_summary" FROM PUBLIC;

