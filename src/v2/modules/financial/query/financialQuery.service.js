import financialQueryRepository from './financialQuery.repository'

/**
 * FinancialQueryService — read-model and reporting queries (Phase 8).
 *
 * Pure reads: never writes ledger/balance, never opens a financial transaction.
 * All monetary values stay as BigInt internally and are stringified for the API
 * mapper layer. Report math uses integer arithmetic only (DEC-012).
 */
class FinancialQueryService {
  async getSpaceBalanceSummary(spaceId) {
    const accounts = await financialQueryRepository.findLedgerAccountsBySpace(spaceId)

    let totalBalance = 0n
    const byKind = new Map()

    for (const account of accounts) {
      const balance = account.current_balance || 0n
      totalBalance += balance
      const kind = account.kind
      byKind.set(kind, (byKind.get(kind) || 0n) + balance)
    }

    return {
      totalAccounts: accounts.length,
      totalBalance: totalBalance.toString(),
      byKind: Object.fromEntries(
        [...byKind.entries()].map(([kind, value]) => [kind, value.toString()])
      )
    }
  }

  async getTransactionHistory(spaceId, { from, to, limit = 50, offset = 0 }) {
    return financialQueryRepository.findTransactionHistoryBySpace(spaceId, {
      from: from ? new Date(from) : null,
      to: to ? new Date(to) : null,
      limit: Math.min(Number(limit) || 50, 200),
      offset: Number(offset) || 0
    })
  }

  async getTransactionDetail(transactionId) {
    return financialQueryRepository.findDetailByTransactionId(transactionId)
  }

  /**
   * Category spend report over a window using POSTED financial transactions.
   * Outflow types reduce money (EXPENSE, LOAN_DISBURSEMENT, REPAYMENT, etc.);
   * inflow types increase money (INCOME, BORROWING, COLLECTION, etc.). The
   * reported magnitude is the transaction amount (already positive).
   */
  async getCategorySpendReport(spaceId, { from, to }) {
    const transactions = await financialQueryRepository.findTransactionsForReport(spaceId, {
      from: from ? new Date(from) : null,
      to: to ? new Date(to) : null
    })

    const OUTFLOW_TYPES = new Set([
      'EXPENSE', 'LOAN_DISBURSEMENT', 'REPAYMENT', 'CONTRIBUTION',
      'SAVING_DEPOSIT', 'ACCUMULATION_CLOSE', 'SAVING_CLOSE', 'SAVING_ROLLOVER_PRINCIPAL'
    ])
    const INFLOW_TYPES = new Set([
      'INCOME', 'BORROWING', 'COLLECTION', 'SAVING_INTEREST_MONTHLY',
      'SAVING_INTEREST_MATURITY', 'SAVING_ROLLOVER_PRINCIPAL_INTEREST'
    ])

    const byCategory = new Map()

    for (const tx of transactions) {
      const isOutflow = OUTFLOW_TYPES.has(tx.type)
      const isInflow = INFLOW_TYPES.has(tx.type)
      // Transfers/contributions-in (internal movement) and opening types do not
      // represent category spend/income, so they are excluded from the report.
      if (!isOutflow && !isInflow) continue

      const categoryId = tx.categories?.public_id || 'uncategorized'
      const current = byCategory.get(categoryId) || { outflow: 0n, inflow: 0n }
      if (isOutflow) current.outflow += tx.amount
      else current.inflow += tx.amount
      byCategory.set(categoryId, current)
    }

    let totalOutflow = 0n
    let totalInflow = 0n
    for (const v of byCategory.values()) {
      totalOutflow += v.outflow
      totalInflow += v.inflow
    }

    return {
      totalOutflow: totalOutflow.toString(),
      totalInflow: totalInflow.toString(),
      categories: [...byCategory.entries()].map(([publicId, v]) => ({
        categoryId: publicId,
        outflow: v.outflow.toString(),
        inflow: v.inflow.toString()
      }))
    }
  }
}

const financialQueryService = new FinancialQueryService()
export default financialQueryService
export { FinancialQueryService }
