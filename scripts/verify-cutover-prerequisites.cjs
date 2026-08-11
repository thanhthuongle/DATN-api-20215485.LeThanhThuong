/**
 * verify-cutover-prerequisites.cjs
 *
 * READ-ONLY pre-cutover go/no-go reporter for API V2 (Wave 8 / Phase 12).
 * Computes the reconciliation gates from `docs/v2/migration/reconciliation-specification.md`
 * §5 and prints GO / NO_GO. It performs SELECT-only queries and NEVER mutates state.
 *
 * Usage:
 *   node scripts/verify-cutover-prerequisites.cjs            # uses POSTGRESQL_DIRECT_URL (local only)
 *   node scripts/verify-cutover-prerequisites.cjs --from-json ./snapshot.json   # dry-run from a JSON snapshot
 *
 * Safety:
 *   - The script will NOT connect to a non-local PostgreSQL URL unless the
 *     operator explicitly sets ALLOW_NON_LOCAL_PREREQ_CHECK=1 AND
 *     ACTIVE_FINANCIAL_WRITE_VERSION != 'V2'.
 *   - This prevents an accidental read against a production database during a
 *     pre-cutover gate that has not been authorized.
 *   - Reports only; it can never change `ACTIVE_FINANCIAL_WRITE_VERSION`.
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const moduleUrl = pathToFileURL(
  path.resolve(__dirname, '../src/v2/infrastructure/cutover/cutoverPrerequisites.js')
).href

function isLocalUrl(url) {
  if (!url) return false
  try {
    const host = new URL(url).hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
  } catch {
    return false
  }
}

async function queryCount(client, sql) {
  const res = await client.query(sql)
  return Number(res.rows[0]?.count ?? 0)
}

async function loadEvaluator() {
  // Native ESM interop: load the pure ESM module from CJS without eval.
  const mod = await import(moduleUrl)
  return { evaluateCutoverPrerequisites: mod.evaluateCutoverPrerequisites }
}

async function runFromDb(evaluator) {
  const { Client } = require('pg')
  const url = process.env.POSTGRESQL_DIRECT_URL || process.env.POSTGRESQL_DATABASE_URL
  const allowNonLocal = process.env.ALLOW_NON_LOCAL_PREREQ_CHECK === '1'
  const writeVersion = process.env.ACTIVE_FINANCIAL_WRITE_VERSION || 'V1'

  if (!isLocalUrl(url) && !allowNonLocal) {
    console.error('BLOCKED: refusing to connect to a non-local PostgreSQL URL.')
    console.error('Set ALLOW_NON_LOCAL_PREREQ_CHECK=1 only after the cutover owner authorizes the pre-cutover check.')
    process.exit(3)
  }
  if (writeVersion === 'V2') {
    console.error('BLOCKED: pre-cutover check refused because ACTIVE_FINANCIAL_WRITE_VERSION is already V2.')
    process.exit(3)
  }

  const client = new Client({ connectionString: url, ssl: isLocalUrl(url) ? false : { rejectUnauthorized: false } })
  await client.connect()
  try {
    const unclassifiedErrors = await queryCount(client,
      `SELECT count(*)::int AS count FROM discrepancy_cases WHERE severity IN ('BLOCKING','REQUIRES_REVIEW') AND status NOT IN ('RESOLVED','IGNORED')`)
    const blockingDiscrepancies = await queryCount(client,
      `SELECT count(*)::int AS count FROM discrepancy_cases WHERE severity='BLOCKING' AND status NOT IN ('RESOLVED','IGNORED')`)
    const unbalancedTransactions = await queryCount(client,
      `SELECT count(*)::int AS count FROM financial_transactions ft WHERE ft.status='POSTED' AND (
         SELECT abs(coalesce(sum(le.amount),0)) FROM ledger_entries le WHERE le.financial_transaction_id=ft.id) <> 0`)
    const balanceMismatches = await queryCount(client,
      `SELECT count(*)::int AS count FROM (
         SELECT la.id FROM ledger_accounts la
         LEFT JOIN LATERAL (
           SELECT balance_after FROM ledger_entries le WHERE le.ledger_account_id=la.id
           ORDER BY le.account_sequence DESC LIMIT 1
         ) last ON true
         WHERE coalesce(last.balance_after,0) <> la.current_balance
       ) x`)

    const deploymentEnv = process.env.DEPLOYMENT_ENV || 'development'
    const routeSmokePassed = process.env.PREREQ_SMOKE_PASSED === '1'

    const report = evaluator.evaluateCutoverPrerequisites({
      unclassifiedErrors,
      blockingDiscrepancies,
      unbalancedTransactions,
      balanceMismatches,
      migrationApplied: true,
      routeSmokePassed,
      deploymentEnv
    })
    printReport(report)
    process.exit(report.pass ? 0 : 2)
  } finally {
    await client.end()
  }
}

function runFromJson(evaluator, file) {
  const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'))
  const report = evaluator.evaluateCutoverPrerequisites(snapshot)
  printReport(report)
  process.exit(report.pass ? 0 : 2)
}

function printReport(report) {
  console.log(`VERDICT: ${report.verdict}`)
  for (const gate of report.gates) {
    console.log(`  ${gate.pass ? 'PASS' : 'FAIL'}  ${gate.name}${'actual' in gate ? ` (${gate.actual})` : ''}`)
  }
  if (report.failingGates.length) {
    console.log(`Failing gates: ${report.failingGates.join(', ')}`)
  }
}

async function main() {
  const evaluator = await loadEvaluator()
  const args = process.argv.slice(2)
  const jsonFlag = args.indexOf('--from-json')
  if (jsonFlag !== -1 && args[jsonFlag + 1]) {
    runFromJson(evaluator, args[jsonFlag + 1])
    return
  }
  await runFromDb(evaluator)
}

main().catch((err) => {
  console.error('ERROR:', err.message)
  process.exit(1)
})
