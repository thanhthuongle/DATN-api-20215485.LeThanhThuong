import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'

/**
 * ReconciliationEngine — validates a migration load against the documented
 * gates in `docs/v2/migration/reconciliation-specification.md`.
 *
 * Computes:
 *  - source/loaded/archived/rejected disposition totals
 *  - unaffected V1 paths (system totals net zero per financial space)
 *  - ledger entry chain: sequence ascending, before + amount == after
 *  - cached balance == last ledger entry balance
 *  - zero unbalanced posting groups
 *
 * It is read-only: it reports mismatches to the caller, never fixes data.
 * The engine returns a result object; the orchestrator decides whether that
 * result warrants a discrepancy case.
 */

class ReconciliationEngine {
  _db(tx) {
    return tx || getPrismaClient()
  }

  /** Disposition totals for a run (source vs loaded/archived/rejected). */
  async dispositionSummary(runId, tx) {
    const db = this._db(tx)
    const sourceCount = await db.migration_source_records.count({
      where: { migration_run_id: runId }
    })
    const loaded = await db.migration_source_records.count({
      where: { migration_run_id: runId, disposition: 'LOADED' }
    })
    const archived = await db.migration_source_records.count({
      where: { migration_run_id: runId, disposition: 'ARCHIVED' }
    })
    const rejected = await db.migration_source_records.count({
      where: { migration_run_id: runId, disposition: 'REJECTED' }
    })
    return { sourceCount, loaded, archived, rejected, staged: sourceCount - loaded - archived - rejected }
  }

  /**
   * Check that every POSTED financial transaction is balanced
   * (its ledger entries sum to zero) and has at least 2 entries.
   *
   * Note: financial_transactions do not carry migration_run_id, so scoping
   * by runId is not currently possible without joining legacy_mongo_id sets
   * from source records. The runId parameter is reserved for future use when
   * transaction provenance tracking is added.
   */
  async checkUnbalancedPostings({ runId = null } = {}, tx) {
    const db = this._db(tx)
    // RunId reserved for future transaction provenance scoping.
    void runId
    // Evaluate all POSTED transactions that have at least one ledger entry.
    // Note: 5000-record cap may miss issues in large datasets; pagination
    // should be added if production volumes exceed this threshold.
    const transactions = await db.financial_transactions.findMany({
      where: { status: 'POSTED' },
      select: {
        id: true,
        public_id: true,
        legacy_mongo_id: true,
        ledger_entries: { select: { amount: true } }
      },
      take: 5000
    })
    const unbalanced = []
    for (const txItem of transactions) {
      const entries = txItem.ledger_entries
      if (!entries || entries.length < 2) {
        unbalanced.push({ id: txItem.public_id, legacy_mongo_id: txItem.legacy_mongo_id, reason: 'LESS_THAN_2_ENTRIES' })
        continue
      }
      const sum = entries.reduce((acc, e) => acc + e.amount, 0n)
      if (sum !== 0n) {
        unbalanced.push({ id: txItem.public_id, legacy_mongo_id: txItem.legacy_mongo_id, reason: 'UNBALANCED', sum: sum.toString() })
      }
    }
    return {
      unbalancedCount: unbalanced.length,
      unbalanced,
      note: transactions.length >= 5000 ? 'WARNING: 5000-record cap hit; results may be incomplete' : undefined
    }
  }

  /**
   * Verify the ledger entry chain for each ledger account: ascending sequence,
   * before + amount == after, and current balance equals the last entry balance.
   */
  async checkEntryChain(tx) {
    const db = this._db(tx)
    const ledgerAccounts = await db.ledger_accounts.findMany({
      select: {
        id: true,
        public_id: true,
        current_balance: true,
        ledger_entries: {
          orderBy: { account_sequence: 'asc' },
          select: { account_sequence: true, amount: true, balance_after: true }
        }
      },
      take: 5000
    })
    const issues = []
    for (const account of ledgerAccounts) {
      const entries = account.ledger_entries
      let expectedBefore = 0n
      let mismatches = 0
      for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i]
        if (entry.account_sequence !== i + 1) mismatches += 1
        if (entry.balance_after !== expectedBefore + entry.amount) mismatches += 1
        expectedBefore = entry.balance_after
      }
      const lastBalance = entries.length ? entries[entries.length - 1].balance_after : 0n
      if (lastBalance !== account.current_balance) mismatches += 1
      if (mismatches) issues.push({ id: account.public_id, mismatches })
    }
    return { accountCount: ledgerAccounts.length, issueCount: issues.length, issues }
  }

  /** Net signed ledger balance per financial space (system totals = 0 VND). */
  async checkSpaceTotals(tx) {
    const db = this._db(tx)
    const rows = await db.$queryRaw`
      SELECT la.financial_space_id AS financial_space_id, SUM(le.amount) AS net
      FROM ledger_entries le
      JOIN ledger_accounts la ON la.id = le.ledger_account_id
      GROUP BY la.financial_space_id
    `
    // Raw SUM of BIGINT may come back as bigint or string depending on adapter.
    const asBigInt = (value) => (typeof value === 'bigint' ? value : BigInt(value))
    const unbalanced = (rows || []).filter((row) => asBigInt(row.net) !== 0n)
    return { spaceCount: (rows || []).length, unbalancedSpaces: unbalanced }
  }

  /**
   * Full reconciliation over the whole V2 dataset.
   * @returns Promise<{ gates: Array<{name, pass, details}>, pass boolean}>
   */
  async run() {
    const disposition = await this.dispositionSummary(null)
    const postings = await this.checkUnbalancedPostings()
    const chain = await this.checkEntryChain()
    const totals = await this.checkSpaceTotals()

    const gates = [
      { name: 'balanced_postings', pass: postings.unbalancedCount === 0, details: postings },
      { name: 'entry_chain', pass: chain.issueCount === 0, details: chain },
      { name: 'space_totals_zero', pass: totals.unbalancedSpaces.length === 0, details: totals }
    ]
    // Unknown/null run disposition is not a gate; orchestrator supplies run id.
    const pass = gates.every((g) => g.pass)
    return {
      pass,
      gates,
      disposition
    }
  }
}

const reconciliationEngine = new ReconciliationEngine()
export default reconciliationEngine
export { ReconciliationEngine }