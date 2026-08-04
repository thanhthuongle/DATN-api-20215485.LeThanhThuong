import transactionManager from '~/v2/modules/financial/core/TransactionManager'
import financialTransactionService from '~/v2/modules/financial/core/financialTransaction.service'
import { v4 as uuidv4 } from 'uuid'

/**
 * IncomeService — V2 income creation via transaction core.
 *
 * Posting template: INCOME
 * - target account: +amount
 * - INCOME_CLEARING system account: -amount
 *
 * Design contract: financial-invariant-matrix.md §4 (INCOME template)
 * Decision: DEC-007, DEC-067
 */

class IncomeService {
  /**
   * Create income transaction.
   * @param {object} params
   * @param {object} params.actor - { type, id }
   * @param {bigint} params.spaceId
   * @param {bigint} params.targetAccountId - internal ID of account receiving money
   * @param {bigint} params.amount - positive amount in VND
   * @param {bigint} [params.categoryId]
   * @param {string} [params.description]
   * @param {Date} [params.occurredAt]
   */
  async createIncome({ actor, spaceId, targetAccountId, amount, categoryId, description, occurredAt }) {
    const correlationId = uuidv4()
    const idempotencyKey = `income-${uuidv4()}`

    return transactionManager.execute({
      actor: { actorType: actor.type || 'USER', actorId: actor.id },
      financialSpaceId: spaceId,
      correlationId,
      idempotencyKey,
      fn: async (txContext) => {
        // 1. Find target account's ledger
        const targetLedger = await txContext.db.ledger_accounts.findFirst({
          where: { account_id: targetAccountId, status: 'ACTIVE' }
        })
        if (!targetLedger) {
          throw new Error(`Active ledger account not found for account ${targetAccountId}`)
        }

        // 2. Find system account INCOME_CLEARING
        const systemDef = await txContext.db.system_account_definitions.findFirst({
          where: { code: 'INCOME_CLEARING', status: 'ACTIVE' }
        })
        if (!systemDef) {
          throw new Error('System account INCOME_CLEARING not found or not active')
        }

        const clearingLedger = await txContext.db.ledger_accounts.findFirst({
          where: { system_role: 'INCOME_CLEARING', financial_space_id: spaceId, status: 'ACTIVE' }
        })
        if (!clearingLedger) {
          throw new Error(`INCOME_CLEARING ledger account not found for space ${spaceId}`)
        }

        // 3. Find posting template for INCOME
        const template = await txContext.db.posting_template_definitions.findFirst({
          where: { code: 'INCOME', status: 'APPROVED' }
        })
        if (!template) {
          throw new Error('Posting template INCOME not found or not APPROVED')
        }

        // 4. Create postings: target +A, clearing -A
        const entries = [
          { ledgerAccountId: targetLedger.id, amount: amount, entryRole: 'TARGET' },
          { ledgerAccountId: clearingLedger.id, amount: -amount, entryRole: 'INCOME_CLEARING' }
        ]

        // 5. Post transaction
        const result = await financialTransactionService.post(txContext, {
          type: 'INCOME',
          postingTemplateDefinitionId: template.id,
          entries,
          businessSnapshot: {
            targetAccountId: targetLedger.id.toString(),
            categoryId: categoryId?.toString() || null,
            description: description || null
          },
          options: {
            categoryId,
            occurredAt: occurredAt?.toISOString() || new Date().toISOString()
          }
        })

        return {
          transactionId: result.transaction.public_id,
          type: 'INCOME',
          amount: amount.toString(),
          targetLedgerAccountId: targetLedger.public_id
        }
      }
    })
  }
}

const incomeService = new IncomeService()
export default incomeService
export { IncomeService }
