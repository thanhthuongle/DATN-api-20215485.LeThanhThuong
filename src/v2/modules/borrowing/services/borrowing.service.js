import transactionManager from '~/v2/modules/financial/core/TransactionManager'
import financialTransactionService from '~/v2/modules/financial/core/financialTransaction.service'
import { v4 as uuidv4 } from 'uuid'

/**
 * BorrowingService — V2 borrowing receipt via transaction core.
 *
 * Posting template: BORROWING
 * - cash target account: +A
 * - BORROWING_LIABILITY system account: -A
 *
 * Design contract: financial-invariant-matrix.md §4 (BORROWING template)
 * Decision: DEC-021, DEC-067
 */
class BorrowingService {
  async createBorrowing({ actor, spaceId, targetAccountId, contactId, amount, rateBasis, rateValue, dueAt, description, occurredAt }) {
    const correlationId = uuidv4()
    const idempotencyKey = `borrowing-${uuidv4()}`

    return transactionManager.execute({
      actor: { actorType: actor.type || 'USER', actorId: actor.id },
      financialSpaceId: spaceId,
      correlationId,
      idempotencyKey,
      fn: async (txContext) => {
        const targetLedger = await txContext.db.ledger_accounts.findFirst({
          where: { account_id: targetAccountId, status: 'ACTIVE' }
        })
        if (!targetLedger) throw new Error(`Target ledger account not found: ${targetAccountId}`)

        const contact = await txContext.db.contacts.findFirst({
          where: { id: contactId, deleted_at: null }
        })
        if (!contact) throw new Error(`Contact/lender not found: ${contactId}`)

        const liabilityLedger = await txContext.db.ledger_accounts.findFirst({
          where: { system_role: 'BORROWING_LIABILITY', financial_space_id: spaceId, status: 'ACTIVE' }
        })
        if (!liabilityLedger) throw new Error(`BORROWING_LIABILITY ledger account not found for space ${spaceId}`)

        const template = await txContext.db.posting_template_definitions.findFirst({
          where: { code: 'BORROWING', status: 'APPROVED' }
        })
        if (!template) throw new Error('Posting template BORROWING not found or not APPROVED')

        // Postings: cash +A, liability -A
        const entries = [
          { ledgerAccountId: targetLedger.id, amount: amount, entryRole: 'CASH_TARGET' },
          { ledgerAccountId: liabilityLedger.id, amount: -amount, entryRole: 'BORROWING_LIABILITY' }
        ]

        const result = await financialTransactionService.post(txContext, {
          type: 'BORROWING',
          postingTemplateDefinitionId: template.id,
          entries,
          businessSnapshot: {
            targetAccountId: targetLedger.id.toString(),
            counterpartyContactId: contactId.toString(),
            rateBasis: rateBasis || 'UNSPECIFIED',
            description: description || null
          },
          options: {
            occurredAt: occurredAt?.toISOString() || new Date().toISOString(),
            metadata: { rateBasis: rateBasis || 'UNSPECIFIED' }
          }
        })

        // Create debt agreement (PAYABLE, OPEN)
        const debtAgreement = await txContext.db.debt_agreements.create({
          data: {
            financial_space_id: spaceId,
            origin_transaction_id: result.transaction.id,
            direction: 'PAYABLE',
            cash_ledger_account_id: targetLedger.id,
            debt_ledger_account_id: liabilityLedger.id,
            counterparty_contact_id: contactId,
            principal_amount: amount,
            rate_value: rateValue || null,
            rate_basis: rateBasis || 'UNSPECIFIED',
            due_at: dueAt || null,
            status: 'OPEN',
            outstanding_principal: amount,
            outstanding_interest: BigInt(0)
          }
        })

        return {
          transactionId: result.transaction.public_id,
          debtAgreementId: debtAgreement.public_id,
          type: 'BORROWING',
          amount: amount.toString(),
          rateBasis: rateBasis || 'UNSPECIFIED'
        }
      }
    })
  }
}

const borrowingService = new BorrowingService()
export default borrowingService
export { BorrowingService }
