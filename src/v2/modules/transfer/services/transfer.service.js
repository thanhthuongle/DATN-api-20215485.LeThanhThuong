import transactionManager from '~/v2/modules/financial/core/TransactionManager'
import financialTransactionService from '~/v2/modules/financial/core/financialTransaction.service'
import { v4 as uuidv4 } from 'uuid'

/**
 * TransferService — V2 transfer creation via transaction core.
 *
 * Posting template: TRANSFER
 * - source account: -amount
 * - target account: +amount
 * - fee is metadata-only (DEC-065), no ledger entry
 *
 * Design contract: financial-invariant-matrix.md §4 (TRANSFER template)
 * Decision: DEC-007, DEC-065, DEC-067, DEC-070
 */
class TransferService {
  async createTransfer({ actor, spaceId, sourceAccountId, targetAccountId, amount, fee, categoryId, description, occurredAt }) {
    const correlationId = uuidv4()
    const idempotencyKey = `transfer-${uuidv4()}`

    return transactionManager.execute({
      actor: { actorType: actor.type || 'USER', actorId: actor.id },
      financialSpaceId: spaceId,
      correlationId,
      idempotencyKey,
      fn: async (txContext) => {
        // Verify source != target (same-space only per DEC-070)
        if (sourceAccountId === targetAccountId) {
          throw new Error('Source and target accounts must be different')
        }

        // Find source ledger
        const sourceLedger = await txContext.db.ledger_accounts.findFirst({
          where: { account_id: sourceAccountId, status: 'ACTIVE' }
        })
        if (!sourceLedger) {
          throw new Error(`Source ledger account not found: ${sourceAccountId}`)
        }

        if (sourceLedger.current_balance < amount) {
          throw new Error(`Insufficient balance: have ${sourceLedger.current_balance}, need ${amount}`)
        }

        // Find target ledger
        const targetLedger = await txContext.db.ledger_accounts.findFirst({
          where: { account_id: targetAccountId, status: 'ACTIVE' }
        })
        if (!targetLedger) {
          throw new Error(`Target ledger account not found: ${targetAccountId}`)
        }

        // Find posting template
        const template = await txContext.db.posting_template_definitions.findFirst({
          where: { code: 'TRANSFER', status: 'APPROVED' }
        })
        if (!template) {
          throw new Error('Posting template TRANSFER not found or not APPROVED')
        }

        // Postings: source -A, target +A (no fee entry per DEC-065)
        const entries = [
          { ledgerAccountId: sourceLedger.id, amount: -amount, entryRole: 'SOURCE' },
          { ledgerAccountId: targetLedger.id, amount: amount, entryRole: 'TARGET' }
        ]

        const result = await financialTransactionService.post(txContext, {
          type: 'TRANSFER',
          postingTemplateDefinitionId: template.id,
          entries,
          businessSnapshot: {
            sourceAccountId: sourceLedger.id.toString(),
            targetAccountId: targetLedger.id.toString(),
            fee: fee?.toString() || '0',
            categoryId: categoryId?.toString() || null,
            description: description || null
          },
          options: {
            categoryId,
            occurredAt: occurredAt?.toISOString() || new Date().toISOString(),
            metadata: { fee: fee?.toString() || '0' }
          }
        })

        return {
          transactionId: result.transaction.public_id,
          type: 'TRANSFER',
          amount: amount.toString()
        }
      }
    })
  }
}

const transferService = new TransferService()
export default transferService
export { TransferService }
