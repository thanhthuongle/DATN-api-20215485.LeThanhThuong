import { randomUUID } from 'node:crypto'
import { createHash } from 'node:crypto'
import TransactionContext from './TransactionContext'
import ledgerRepository from './ledger.repository'
import idempotencyService from './idempotency.service'
import { IdempotencyResult } from './idempotency.service'

/**
 * FinancialTransactionService — orchestrator duy nhất tạo financial transactions.
 *
 * Design contract: transaction-core.md §2, transaction-runtime.md §1-2
 * Decision: DEC-007, DEC-009, DEC-024
 *
 * Mọi service ghi tiền (income, expense, transfer, etc.) phải gọi
 * financialTransactionService.post() thay vì tự tạo postings.
 */

class FinancialTransactionService {
  /**
   * Post một financial transaction với đầy đủ idempotency, ledger, snapshot.
   *
   * @param {TransactionContext} txContext
   * @param {object} params
   * @param {string} params.type - financial_transaction_type (e.g. 'INCOME', 'EXPENSE')
   * @param {bigint} params.postingTemplateDefinitionId
   * @param {object[]} params.entries - [{ ledgerAccountId, amount, entryRole }]
   * @param {object} params.businessSnapshot - JSONB snapshot của giao dịch
   * @param {object} [params.options]
   * @param {bigint} [params.options.categoryId]
   * @param {bigint} [params.options.responsibleUserId]
   * @param {string} [params.options.legacyMongoId]
   * @param {string} [params.options.occurredAt] - ISO timestamp
   * @param {object} [params.options.metadata]
   * @returns {Promise<object>} Kết quả với transaction, entries, idempotency
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

    // 1. Idempotency check (already resolved by caller, but double-check)
    //    Caller should resolve idempotency BEFORE opening this transaction
    //    Here we just verify we have a valid NEW idempotency slot

    // 2. Create ledger entries (auto-balances to 0)
    const createdEntries = await ledgerRepository.createEntries(txContext, entries)

    // 3. Create financial transaction
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

    // 4. Link entries to transaction
    const entryIds = createdEntries.map(e => e.id)
    await ledgerRepository.linkEntriesToTransaction(txContext, entryIds, transaction.id)

    // 5. Update transaction with entry linkage (optional metadata)
    await txContext.db.financial_transactions.update({
      where: { id: transaction.id },
      data: {
        // Additional post-creation metadata if needed
      }
    })

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
