import TransactionContext from './TransactionContext'

/**
 * LedgerRepository — quản lý ledger entries và account balances.
 * Tất cả write operation phải qua TransactionContext.
 *
 * Design contract: transaction-core.md §3-4, §9
 * Decision: DEC-007, DEC-008, DEC-009
 *
 * Invariant: ledger entries đã POST không được update/delete.
 * Invariant: tổng postings của một transaction phải = 0.
 * Invariant: chỉ transaction core được cập nhật cached balance.
 */

class LedgerRepository {
  /**
   * Khóa ledger accounts theo thứ tự ascending ID để tránh deadlock.
   * Sử dụng FOR UPDATE trong PostgreSQL transaction.
   *
   * @param {TransactionContext} txContext
   * @param {bigint[]} ledgerAccountIds - Mảng ledger account internal IDs
   * @returns {Promise<object[]>} Các ledger account đã khóa
   */
  async lockAccountsForUpdate(txContext, ledgerAccountIds) {
    TransactionContext.assertTransactionContext(txContext)

    // Sort ascending để consistent lock order
    const sortedIds = [...ledgerAccountIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

    const accounts = await txContext.db.$queryRaw`
      SELECT * FROM ledger_accounts
      WHERE id = ANY(${sortedIds}::bigint[])
      AND status = 'ACTIVE'
      FOR UPDATE
    `

    // Verify đủ số account được lock
    if (!accounts || accounts.length !== sortedIds.length) {
      const foundIds = (accounts || []).map(a => a.id)
      const missingIds = sortedIds.filter(id => !foundIds.includes(id))
      throw new Error(
        `Cannot lock all required ledger accounts. Missing: ${missingIds.join(',')}. ` +
        `Expected ${sortedIds.length}, got ${(accounts || []).length}`
      )
    }

    return accounts
  }

  /**
   * Tạo ledger entries trong một transaction.
   * Postings phải cân bằng (tổng = 0) — caller tự chịu trách nhiệm.
   *
   * @param {TransactionContext} txContext
   * @param {object[]} entries - [{ ledgerAccountId, amount, entryRole, balanceBefore?, balanceAfter? }]
   * @returns {Promise<object[]>} Các ledger entry đã tạo
   */
  async createEntries(txContext, entries) {
    TransactionContext.assertTransactionContext(txContext)

    if (!entries || entries.length === 0) {
      throw new Error('LedgerRepository.createEntries requires at least one entry')
    }

    // Verify postings sum to zero (financial invariant)
    const sum = entries.reduce((acc, e) => acc + e.amount, BigInt(0))
    if (sum !== BigInt(0)) {
      throw new Error(
        `Ledger postings do not sum to zero. Sum: ${sum}. ` +
        'All financial transactions must have balanced postings.'
      )
    }

    // Lấy current sequence cho từng account và lock
    const accountIds = [...new Set(entries.map(e => BigInt(e.ledgerAccountId)))]
    const accounts = await this.lockAccountsForUpdate(txContext, accountIds)

    const accountMap = new Map()
    for (const account of accounts) {
      accountMap.set(account.id, {
        currentBalance: account.current_balance,
        currentSequence: account.current_sequence
      })
    }

    // Build entries with sequence and balance
    const createdEntries = []
    for (const entry of entries) {
      const accId = BigInt(entry.ledgerAccountId)
      const acc = accountMap.get(accId)
      if (!acc) {
        throw new Error(`Ledger account not found: ${accId}`)
      }

      const newSequence = acc.currentSequence + BigInt(1)
      const newBalance = acc.currentBalance + BigInt(entry.amount)

      const created = await txContext.db.ledger_entries.create({
        data: {
          ledger_account_id: accId,
          account_sequence: newSequence,
          amount: entry.amount,
          balance_before: entry.balanceBefore !== undefined ? entry.balanceBefore : acc.currentBalance,
          balance_after: entry.balanceAfter !== undefined ? entry.balanceAfter : newBalance,
          entry_role: entry.entryRole || 'PRIMARY',
          posted_at: new Date()
        }
      })

      // Update account state in memory
      acc.currentBalance = newBalance
      acc.currentSequence = newSequence

      createdEntries.push(created)
    }

    // Bulk update current_balance and current_sequence
    for (const [accId, acc] of accountMap) {
      await txContext.db.ledger_accounts.update({
        where: { id: accId },
        data: {
          current_balance: acc.currentBalance,
          current_sequence: acc.currentSequence,
          updated_at: new Date()
        }
      })
    }

    return createdEntries
  }

  /**
   * Link ledger entries to a financial transaction.
   * @param {TransactionContext} txContext
   * @param {bigint[]} entryIds
   * @param {bigint} transactionId
   */
  async linkEntriesToTransaction(txContext, entryIds, transactionId) {
    TransactionContext.assertTransactionContext(txContext)

    return txContext.db.ledger_entries.updateMany({
      where: { id: { in: entryIds } },
      data: { financial_transaction_id: transactionId }
    })
  }

  /**
   * Get ledger entries for a transaction (read-only).
   * @param {TransactionContext} txContext
   * @param {bigint} transactionId
   */
  async getEntriesByTransaction(txContext, transactionId) {
    TransactionContext.assertTransactionContext(txContext)

    return txContext.db.ledger_entries.findMany({
      where: { financial_transaction_id: transactionId },
      orderBy: { account_sequence: 'asc' }
    })
  }

  /**
   * Rebuild balance for a ledger account from entries (for reconciliation).
   * @param {TransactionContext} txContext
   * @param {bigint} ledgerAccountId
   * @returns {Promise<bigint>} Computed balance from all entries
   */
  async computeBalanceFromEntries(txContext, ledgerAccountId) {
    TransactionContext.assertTransactionContext(txContext)

    const result = await txContext.db.ledger_entries.aggregate({
      where: { ledger_account_id: ledgerAccountId },
      _sum: { amount: true }
    })

    return result._sum.amount || BigInt(0)
  }
}

// Singleton instance
const ledgerRepository = new LedgerRepository()

export default ledgerRepository
export { LedgerRepository }
