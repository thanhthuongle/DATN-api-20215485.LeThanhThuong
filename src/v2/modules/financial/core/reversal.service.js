import TransactionContext from './TransactionContext'
import ledgerRepository from './ledger.repository'

/**
 * ReversalService — tạo full reversal cho một financial transaction đã POST.
 *
 * Design contract: transaction-runtime.md §2
 * Decision: DEC-009
 *
 * - Reversal tạo transaction POSTED mới với postings ngược.
 * - Khóa original transaction, không sửa/xóa entries gốc.
 * - Unique rule ngăn full reversal lần hai.
 * - Chỉ hỗ trợ full reversal (không partial).
 */

class ReversalService {
  /**
   * Tạo full reversal cho một transaction.
   *
   * @param {TransactionContext} txContext
   * @param {object} params
   * @param {bigint} params.originalTransactionId - Internal ID của transaction gốc
   * @param {bigint} params.postingTemplateDefinitionId
   * @param {object} params.businessSnapshot
   * @returns {Promise<object>}
   */
  async reverse(txContext, { originalTransactionId, postingTemplateDefinitionId, businessSnapshot }) {
    TransactionContext.assertTransactionContext(txContext)

    // 1. Lock và verify original transaction
    const originalTx = await txContext.db.financial_transactions.findUnique({
      where: { id: originalTransactionId }
    })

    if (!originalTx) {
      throw new Error(`Original transaction not found: ${originalTransactionId}`)
    }

    if (originalTx.status !== 'POSTED') {
      throw new Error(
        `Cannot reverse transaction in status ${originalTx.status}. Only POSTED transactions can be reversed.`
      )
    }

    // Check if already reversed (unique constraint on reverses_transaction_id)
    const existingReversal = await txContext.db.financial_transactions.findFirst({
      where: { reverses_transaction_id: originalTransactionId, status: 'POSTED' }
    })
    if (existingReversal) {
      throw new Error(
        `Transaction ${originalTransactionId} has already been reversed by ${existingReversal.id}. ` +
        'Only one full reversal is allowed per transaction.'
      )
    }

    // 2. Get original entries
    const originalEntries = await ledgerRepository.getEntriesByTransaction(txContext, originalTransactionId)

    if (!originalEntries || originalEntries.length === 0) {
      throw new Error(`No ledger entries found for transaction ${originalTransactionId}`)
    }

    // 3. Create reversal entries (exact opposite)
    const reversalEntries = originalEntries.map(entry => ({
      ledgerAccountId: entry.ledger_account_id,
      amount: -entry.amount, // Reverse sign
      entryRole: `REVERSAL_${entry.entry_role}`
    }))

    // 4. Create reversal transaction
    const reversalTx = await txContext.db.financial_transactions.create({
      data: {
        type: 'REVERSAL',
        posting_template_definition_id: postingTemplateDefinitionId,
        financial_space_id: txContext.financialSpaceId,
        status: 'POSTED',
        amount: originalTx.amount,
        business_snapshot: {
          ...businessSnapshot,
          originalTransactionId,
          originalTransactionPublicId: originalTx.public_id
        },
        reverses_transaction_id: originalTransactionId,
        occurred_at: new Date()
      }
    })

    // 5. Create reversal ledger entries
    const createdReversalEntries = await ledgerRepository.createEntries(txContext, reversalEntries)

    // 6. Link reversal entries
    await ledgerRepository.linkEntriesToTransaction(
      txContext,
      createdReversalEntries.map(e => e.id),
      reversalTx.id
    )

    // 7. Update original transaction status
    await txContext.db.financial_transactions.update({
      where: { id: originalTransactionId },
      data: { status: 'REVERSED', updated_at: new Date() }
    })

    return {
      originalTransaction: originalTx,
      reversalTransaction: reversalTx,
      entries: createdReversalEntries
    }
  }
}

// Singleton
const reversalService = new ReversalService()

export default reversalService
export { ReversalService }
