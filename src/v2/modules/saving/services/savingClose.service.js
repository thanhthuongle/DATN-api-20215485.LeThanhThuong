import transactionManager from '~/v2/modules/financial/core/TransactionManager'
import financialTransactionService from '~/v2/modules/financial/core/financialTransaction.service'
import idempotencyService from '~/v2/modules/financial/core/idempotency.service'
import { IdempotencyResult } from '~/v2/modules/financial/core/idempotency.service'
import { v4 as uuidv4 } from 'uuid'
import { createHash } from 'node:crypto'

/**
 * SavingCloseService — V2 saving close via transaction core.
 *
 * Posting template: SAVING_CLOSE
 * - saving -(P+I); target +(P+I)
 *
 * Design contract: financial-invariant-matrix.md §4, interest-rate-rules.md §2
 * Decision: DEC-021, DEC-069
 *
 * Contract: close transfers the saving's CURRENT ledger balance (principal +
 * any interest already recognized by accrueMaturity for MATURITY schedule; for
 * MONTHLY schedule interest was paid out each month so only principal remains).
 * Close does NOT recompute/recognize interest (avoids double count with the
 * maturity accrual job — reviewer finding MI-5/SC-1).
 */
class SavingCloseService {
  async close({ actor, spaceId, savingId, targetAccountId, now }) {
    const correlationId = uuidv4()
    const operation = 'SAVING_CLOSE'
    const idempotencyKey = `saving-close-${savingId}`

    return transactionManager.execute({
      actor: { actorType: actor.type || 'USER', actorId: actor.id || 'system' },
      financialSpaceId: spaceId,
      correlationId,
      idempotencyKey,
      fn: async (txContext) => {
        // Idempotency: reject duplicate close on retry
        const idem = await idempotencyService.resolveIdempotency(txContext, {
          operation,
          idempotencyKey,
          requestHash: createHash('sha256').update(`close|${savingId}`).digest('hex')
        })
        if (idem.result !== IdempotencyResult.NEW) {
          throw new Error(`Idempotency conflict for ${operation}: ${idem.result}`)
        }

        const saving = await txContext.db.savings_accounts.findFirst({
          where: { id: savingId, status: 'ACTIVE', deleted_at: null }
        })
        if (!saving) throw new Error(`Active saving not found: ${savingId}`)

        // current saving ledger balance = principal (+ recognized interest for MATURITY)
        const savingLedger = await txContext.db.ledger_accounts.findFirst({
          where: { saving_account_id: savingId, status: 'ACTIVE' }
        })
        if (!savingLedger) throw new Error(`Saving ledger account not found: ${savingId}`)

        const total = savingLedger.current_balance
        if (total <= BigInt(0)) {
          throw new Error(`Cannot close saving with non-positive balance: ${total}`)
        }

        const targetLedger = await txContext.db.ledger_accounts.findFirst({
          where: { account_id: targetAccountId, status: 'ACTIVE' }
        })
        if (!targetLedger) throw new Error(`Target ledger account not found: ${targetAccountId}`)

        const template = await txContext.db.posting_template_definitions.findFirst({
          where: { code: 'SAVING_CLOSE', status: 'APPROVED' }
        })
        if (!template) throw new Error('Posting template SAVING_CLOSE not found')

        // Close: saving -total, target +total (sum 0)
        const closeRes = await financialTransactionService.post(txContext, {
          type: 'SAVING_CLOSE',
          postingTemplateDefinitionId: template.id,
          entries: [
            { ledgerAccountId: savingLedger.id, amount: -total, entryRole: 'SAVING' },
            { ledgerAccountId: targetLedger.id, amount: total, entryRole: 'TARGET' }
          ],
          businessSnapshot: {
            savingId: savingId.toString(),
            principal: saving.principal_amount.toString(),
            total: total.toString()
          },
          options: {
            occurredAt: (now || new Date()).toISOString(),
            metadata: { total: total.toString() }
          }
        })

        // Complete idempotency slot
        await idempotencyService.completeSlot(txContext, {
          idempotencyRecordId: idem.record.id,
          resourceType: 'savings_account',
          resourcePublicId: saving.public_id,
          responseBody: { total: total.toString() },
          responseStatus: 200
        })

        // Mark saving CLOSED
        await txContext.db.savings_accounts.update({
          where: { id: savingId },
          data: { status: 'CLOSED', closed_at: new Date() }
        })

        // Record CLOSE period (ordinal >= 1)
        await txContext.db.saving_periods.create({
          data: {
            saving_account_id: savingId,
            period_ordinal: 1,
            action: 'CLOSE',
            due_at: now || new Date(),
            status: 'COMPLETED',
            financial_transaction_id: closeRes.transaction.id,
            idempotency_key: idempotencyKey,
            completed_at: new Date()
          }
        })

        return {
          transactionId: closeRes.transaction.public_id,
          principal: saving.principal_amount.toString(),
          total: total.toString(),
          status: 'CLOSED'
        }
      }
    })
  }
}

const savingCloseService = new SavingCloseService()
export default savingCloseService
export { SavingCloseService }

