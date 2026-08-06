import transactionManager from '~/v2/modules/financial/core/TransactionManager'
import financialTransactionService from '~/v2/modules/financial/core/financialTransaction.service'
import { v4 as uuidv4 } from 'uuid'

/**
 * ExpenseService — V2 expense creation via transaction core.
 *
 * Posting template: EXPENSE
 * - source account: -amount
 * - EXPENSE_CLEARING system account: +amount
 *
 * Design contract: financial-invariant-matrix.md §4 (EXPENSE template)
 * Decision: DEC-007, DEC-067
 */
class ExpenseService {
  async createExpense({ actor, spaceId, sourceAccountId, amount, categoryId, description, occurredAt }) {
    const correlationId = uuidv4()
    const idempotencyKey = `expense-${uuidv4()}`

    return transactionManager.execute({
      actor: { actorType: actor.type || 'USER', actorId: actor.id },
      financialSpaceId: spaceId,
      correlationId,
      idempotencyKey,
      fn: async (txContext) => {
        // Find source account's ledger and verify balance
        const sourceLedger = await txContext.db.ledger_accounts.findFirst({
          where: { account_id: sourceAccountId, status: 'ACTIVE' }
        })
        if (!sourceLedger) {
          throw new Error(`Active ledger account not found for account ${sourceAccountId}`)
        }

        // Verify sufficient balance
        if (sourceLedger.current_balance < amount) {
          throw new Error(`Insufficient balance: have ${sourceLedger.current_balance}, need ${amount}`)
        }

        // Find EXPENSE_CLEARING system account
        const clearingLedger = await txContext.db.ledger_accounts.findFirst({
          where: { system_role: 'EXPENSE_CLEARING', financial_space_id: spaceId, status: 'ACTIVE' }
        })
        if (!clearingLedger) {
          throw new Error(`EXPENSE_CLEARING ledger account not found for space ${spaceId}`)
        }

        // Find posting template
        const template = await txContext.db.posting_template_definitions.findFirst({
          where: { code: 'EXPENSE', status: 'APPROVED' }
        })
        if (!template) {
          throw new Error('Posting template EXPENSE not found or not APPROVED')
        }

        // Postings: source -A, clearing +A
        const entries = [
          { ledgerAccountId: sourceLedger.id, amount: -amount, entryRole: 'SOURCE' },
          { ledgerAccountId: clearingLedger.id, amount: amount, entryRole: 'EXPENSE_CLEARING' }
        ]

        const result = await financialTransactionService.post(txContext, {
          type: 'EXPENSE',
          postingTemplateDefinitionId: template.id,
          entries,
          businessSnapshot: {
            sourceAccountId: sourceLedger.id.toString(),
            categoryId: categoryId?.toString() || null,
            description: description || null
          },
          options: { categoryId, occurredAt: occurredAt?.toISOString() || new Date().toISOString() }
        })

        return {
          transactionId: result.transaction.public_id,
          type: 'EXPENSE',
          amount: amount.toString()
        }
      }
    })
  }
}

const expenseService = new ExpenseService()
export default expenseService
export { ExpenseService }
