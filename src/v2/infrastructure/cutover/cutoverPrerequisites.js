/**
 * Cutover prerequisites / go-no-go evaluation (API V2).
 *
 * Mirrors the go/no-go gates defined in
 * `docs/v2/migration/reconciliation-specification.md` §5:
 *   unclassifiedErrors = 0, blockingDiscrepancies = 0,
 *   unbalancedTransactions = 0, balanceMismatches = 0   ->  GO.
 *
 * PURE: takes counts are explicit inputs so it is unit-testable without a live
 * database. The runbook / CLI supplies real counts from a READ-ONLY query.
 * The evaluation never mutates state — it only reports GO / NO_GO.
 */

export const evaluateCutoverPrerequisites = ({
  unclassifiedErrors = 0,
  blockingDiscrepancies = 0,
  unbalancedTransactions = 0,
  balanceMismatches = 0,
  migrationApplied = false,
  routeSmokePassed = false,
  deploymentEnv = 'development'
} = {}) => {
  const gates = [
    { name: 'migration_applied', pass: migrationApplied === true, actual: migrationApplied },
    { name: 'unclassified_errors_zero', pass: unclassifiedErrors === 0, actual: unclassifiedErrors },
    { name: 'blocking_discrepancies_zero', pass: blockingDiscrepancies === 0, actual: blockingDiscrepancies },
    { name: 'unbalanced_transactions_zero', pass: unbalancedTransactions === 0, actual: unbalancedTransactions },
    { name: 'balance_mismatches_zero', pass: balanceMismatches === 0, actual: balanceMismatches },
    { name: 'critical_flow_smoke_passed', pass: routeSmokePassed === true, actual: routeSmokePassed },
    { name: 'deployment_env_is_production', pass: deploymentEnv === 'production', actual: deploymentEnv }
  ]

  const pass = gates.every((g) => g.pass)

  return Object.freeze({
    verdict: pass ? 'GO' : 'NO_GO',
    pass,
    gates: Object.freeze(gates.map((g) => Object.freeze(g))),
    failingGates: Object.freeze(gates.filter((g) => !g.pass).map((g) => g.name))
  })
}
