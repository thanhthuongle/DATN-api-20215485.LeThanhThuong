/**
 * Write-authority / cutover control helpers (API V2).
 *
 * Enforces the single financial write-authority invariant (DEC-003 / DEC-039 /
 * DEC-064): at any moment only one of V1 (MongoDB) or V2 (PostgreSQL) holds
 * financial write authority, and the switch happens ONLY at cutover in a
 * deployment-capable environment. V1 remains the write authority until the
 * documented cutover (master-plan.md §16 step 9) explicitly flips the flag.
 *
 * This module is PURE: it takes explicit inputs and returns decisions; it never
 * touches a database or reads process env directly. It is the unit-testable
 * decision core for the cutover runbook and the pre-cutover checklist.
 */

export const WRITE_VERSIONS = Object.freeze(['V1', 'V2'])

/**
 * Resolve the current write-authority posture.
 * V2 may only hold write authority in a `production` deployment environment
 * (mirrors `DEPLOYMENT_ENV !== 'production'` forcing V2 off in environment.js).
 */
export const resolveWriteAuthority = ({
  activeFinancialWriteVersion = 'V1',
  deploymentEnv = 'development'
} = {}) => {
  if (!WRITE_VERSIONS.includes(activeFinancialWriteVersion)) {
    throw new Error('ACTIVE_FINANCIAL_WRITE_VERSION must be V1 or V2')
  }

  const isV2Writable = activeFinancialWriteVersion === 'V2' && deploymentEnv === 'production'

  return Object.freeze({
    activeVersion: activeFinancialWriteVersion,
    deploymentEnv,
    isV1Writable: activeFinancialWriteVersion === 'V1',
    isV2Writable,
    note: isV2Writable
      ? 'financial write authority is V2'
      : 'financial write authority is NOT V2'
  })
}

/**
 * Decide whether V2 financial writes may be opened (the cutover flip).
 *
 * Guard rails from master-plan.md §16 (go/no-go) and rollback-before-write:
 * - only in a production deployment;
 * - only while currently on V1 (flip, not dual authority);
 * - only after the migration is applied, reconciliation is clean
 *   (0 BLOCKING discrepancies), and any `MIGRATION_EQUITY` anchors are approved.
 */
export const canOpenV2Writes = ({
  activeFinancialWriteVersion = 'V1',
  deploymentEnv = 'development',
  migrationApplied = false,
  reconciliationClean = false,
  migrationAnchorApproved = false
} = {}) => {
  const gates = [
    { name: 'deployment_env_is_production', pass: deploymentEnv === 'production', detail: deploymentEnv },
    { name: 'current_version_is_v1', pass: activeFinancialWriteVersion === 'V1', detail: activeFinancialWriteVersion },
    { name: 'migration_applied', pass: migrationApplied === true, detail: String(migrationApplied) },
    { name: 'reconciliation_clean_0_blocking', pass: reconciliationClean === true, detail: String(reconciliationClean) },
    { name: 'migration_anchor_approved', pass: migrationAnchorApproved === true, detail: String(migrationAnchorApproved) }
  ]

  const pass = gates.every((g) => g.pass)

  return Object.freeze({
    canOpen: pass,
    verdict: pass ? 'CAN_OPEN_V2_WRITES' : 'DO_NOT_OPEN_V2_WRITES',
    gates: Object.freeze(gates.map((g) => Object.freeze(g))),
    failingGates: Object.freeze(gates.filter((g) => !g.pass).map((g) => g.name))
  })
}
