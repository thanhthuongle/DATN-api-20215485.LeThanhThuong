import TransactionContext from './TransactionContext'
import ledgerRepository from './ledger.repository'

/**
 * ReconciliationService — kiểm tra tính nhất quán giữa ledger và cached balance.
 *
 * Design contract: transaction-core.md §8
 * Decision: DEC-008, DEC-026
 *
 * Sai lệch tạo discrepancy case, không âm thầm chỉnh balance.
 */

class ReconciliationService {
  /**
   * Kiểm tra SUM(ledger entries) = current_balance cho một ledger account.
   *
   * @param {TransactionContext} txContext
   * @param {bigint} ledgerAccountId
   * @returns {Promise<{ match: boolean, ledgerSum: bigint, cachedBalance: bigint, difference: bigint }>}
   */
  async reconcileAccount(txContext, ledgerAccountId) {
    TransactionContext.assertTransactionContext(txContext)

    const account = await txContext.db.ledger_accounts.findUnique({
      where: { id: ledgerAccountId }
    })

    if (!account) {
      throw new Error(`Ledger account not found: ${ledgerAccountId}`)
    }

    const ledgerSum = await ledgerRepository.computeBalanceFromEntries(txContext, ledgerAccountId)
    const cachedBalance = account.current_balance
    const difference = ledgerSum - cachedBalance

    return {
      match: difference === BigInt(0),
      ledgerSum,
      cachedBalance,
      difference
    }
  }

  /**
   * Reconcile tất cả account trong một financial space.
   *
   * @param {TransactionContext} txContext
   * @returns {Promise<Array<{ ledgerAccountId, match, difference }>>}
   */
  async reconcileSpace(txContext) {
    TransactionContext.assertTransactionContext(txContext)

    const accounts = await txContext.db.ledger_accounts.findMany({
      where: { financial_space_id: txContext.financialSpaceId, status: 'ACTIVE' }
    })

    const results = []
    for (const account of accounts) {
      const result = await this.reconcileAccount(txContext, account.id)
      results.push({
        ledgerAccountId: account.id,
        ledgerAccountPublicId: account.public_id,
        kind: account.kind,
        ...result
      })
    }

    return results
  }

  /**
   * Tạo discrepancy case khi phát hiện sai lệch.
   *
   * @param {TransactionContext} txContext
   * @param {object} params
   * @param {string} params.source - discrepancy_source (RECONCILIATION, SNAPSHOT, OUTBOX, JOB, MIGRATION)
   * @param {string} params.severity - discrepancy_severity
   * @param {string} params.summary
   * @param {object} params.details
   * @param {bigint} [params.ledgerAccountId]
   */
  async createDiscrepancy(txContext, {
    source,
    severity = 'REQUIRES_REVIEW',
    summary,
    details,
    ledgerAccountId = null
  }) {
    TransactionContext.assertTransactionContext(txContext)

    return txContext.db.discrepancy_cases.create({
      data: {
        financial_space_id: txContext.financialSpaceId,
        source,
        severity,
        status: 'OPEN',
        summary,
        details,
        ledger_account_id: ledgerAccountId,
        detected_at: new Date()
      }
    })
  }
}

// Singleton
const reconciliationService = new ReconciliationService()

export default reconciliationService
export { ReconciliationService }
