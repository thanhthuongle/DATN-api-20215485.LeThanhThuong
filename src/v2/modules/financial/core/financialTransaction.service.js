import TransactionContext from './TransactionContext'
import ledgerRepository from './ledger.repository'

/**
 * FinancialTransactionService — orchestrator duy nhất tạo financial transactions.
 *
 * Design contract: transaction-core.md §2, transaction-runtime.md §1-2
 * Decision: DEC-007, DEC-009, DEC-024
 *
 * Mọi service ghi tiền (income, expense, transfer, etc.) phải gọi
 * financialTransactionService.post() thay vì tự tạo postings.
 *
 * Note: Idempotency must be resolved by the caller BEFORE opening the
 * transaction. The caller checks idempotencyService.resolveIdempotency(),
 * and only proceeds to post() if the result is NEW.
 */

class FinancialTransactionService {
  /**
   * Post một financial transaction.
   * Caller MUST resolve idempotency before calling this method.
   */
  async post(txContext, { type, postingTemplateDefinitionId, entries, businessSnapshot, options = {} }) {
    TransactionContext.assertTransactionContext(txContext)

    // Validate amount > 0 (DEC-067)
    const totalAmount = entries.reduce((sum, e) => {
      return sum + (e.amount > BigInt(0) ? e.amount : BigInt(0))
    }, BigInt(0))
    if (totalAmount <= BigInt(0)) {
      throw new Error('Money-moving commands require amount > 0 (DEC-067)')
    }

    // Create ledger entries (auto-validates sum=0)
    const createdEntries = await ledgerRepository.createEntries(txContext, entries)

    // Create financial transaction
    const transaction = await txContext.db.financial_transactions.create({
      data: {
        type,
        posting_template_definition_id: postingTemplateDefinitionId,
        financial_space_id: txContext.financialSpaceId,
        status: 'POSTED',
        amount: totalAmount,
        business_snapshot: businessSnapshot || {},
        category_id: options.categoryId || null,
        responsible_user_id: options.responsibleUserId || null,
        legacy_mongo_id: options.legacyMongoId || null,
        occurred_at: options.occurredAt ? new Date(options.occurredAt) : new Date(),
        metadata: options.metadata || {}
      }
    })

    // Link entries to transaction
    const entryIds = createdEntries.map(e => e.id)
    await ledgerRepository.linkEntriesToTransaction(txContext, entryIds, transaction.id)

    return {
      transaction,
      entries: createdEntries
    }
  }
}

// Singleton
const financialTransactionService = new FinancialTransactionService()

export default financialTransactionService
export { FinancialTransactionService }
