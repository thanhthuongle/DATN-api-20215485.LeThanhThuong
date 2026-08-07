/**
 * Migration module shared constants.
 *
 * Source of truth for the 26 declared V1 collections and the pipeline
 * versions used when staging a migration run. Mirrors the references in:
 * - `docs/v2/migration/migration-rule-catalog.md` (26 collections)
 * - `docs/v2/migration/load-dependency-graph.md` (graph levels L0..L20)
 * - `scripts/lib/wave2-export-reader.cjs` (declared collections)
 *
 * Decision: DEC-013 (docs under docs/v2), DEC-022 (legacy_mongo_id).
 */

export const MIGRATION_MAPPING_VERSION = 'wave6-runtime-pipeline-v1'
export const MIGRATION_SANITIZATION_POLICY_VERSION = 'wave6-redaction-v1'

export const SCHEMA_VERSION = '20260802125000'

/** The 26 declared V1 source collections, ordered by dependency graph level. */
export const DECLARED_SOURCE_COLLECTIONS = Object.freeze([
  // L2 root identity
  'users',
  // L4/L5 reference and ownership
  'families',
  'banks',
  'categories',
  'contacts',
  // L7 legacy money-source envelopes (archive-only)
  'money_sources',
  // L8 balance holders
  'accounts',
  'accumulations',
  'savings_accounts',
  // L10 budgets
  'budgets',
  // L11 transaction headers
  'transactions',
  // L12 detail facts
  'expenses',
  'incomes',
  'transfers',
  'contributions',
  // L13/L14 debt
  'loans',
  'borrowings',
  'collections',
  'repayments',
  // L15 notifications
  'notifications',
  'user_notifications',
  // L17 schema-only archive lanes
  'contribution_requests',
  'group_payouts',
  'invitations',
  'proposal_expenses',
  'system_tasks'
])

/**
 * Collections that are archived as-is and never load a financial posting.
 * Source: `docs/v2/migration/migration-rule-catalog.md` (APPROVED_ARCHIVE).
 */
export const ARCHIVE_ONLY_COLLECTIONS = Object.freeze(new Set([
  'money_sources',
  'contribution_requests',
  'group_payouts',
  'invitations',
  'proposal_expenses',
  'system_tasks'
]))

/** Collections that are schema-only (never produce any business record). */
export const SCHEMA_ONLY_COLLECTIONS = Object.freeze(new Set([
  'contribution_requests',
  'group_payouts',
  'invitations',
  'proposal_expenses'
]))

/**
 * Source fields that must be redacted before staging into
 * `migration_source_records.raw_document`. Verified token/password material is
 * dropped; identity/media fields are pseudonymized. Keep parity with
 * `scripts/lib/wave2-export-sanitizer.cjs`.
 */
export const REDACTED_FIELD_PATTERN = /(?:password|passwd|pwd|verifyToken|token|secret|authorization)/i

export const DETERMINISTIC_ORDER_PATTERN = /(?:Id|Ids|At|Time|Date)$/i