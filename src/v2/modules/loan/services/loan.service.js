import transactionManager from '~/v2/modules/financial/core/TransactionManager'
import financialTransactionService from '~/v2/modules/financial/core/financialTransaction.service'
import { v4 as uuidv4 } from 'uuid'

/**
 * LoanService — V2 loan disbursement via transaction core.
 *
 * Posting template: LOAN_DISBURSEMENT
 * - cash source account: -A
 * - LOAN_RECEIVABLE system account: +A
 *
 * Design contract: financial-invariant-matrix.md §4 (LOAN_DISBURSEMENT template)
 * Decision: DEC-021, DEC-067
 */
class LoanService {
  async createLoan({ actor, spaceId, sourceAccountId, contactId, amount, rateBasis, rateValue, dueAt, description, occurredAt }) {
    const correlationId = uuidv4()
    const idempotencyKey = `loan-disbursement-${uuidv4()}`

    return transactionManager.execute({
      actor: { actorType: actor.type || 'USER', actorId: actor.id },
      financialSpaceId: spaceId,
      correlationId,
      idempotencyKey,
      fn: async (txContext) => {
        const sourceLedger = await txContext.db.ledger_accounts.findFirst({
          where: { account_id: sourceAccountId, status: 'ACTIVE' }
        })
        if (!sourceLedger) throw new Error(`Source ledger account not found: ${sourceAccountId}`)
        if (sourceLedger.current_balance < amount) {
          throw new Error(`Insufficient balance: have ${sourceLedger.current_balance}, need ${amount}`)
        }

        const contact = await txContext.db.contacts.findFirst({
          where: { id: contactId, deleted_at: null }
        })
        if (!contact) throw new Error(`Contact/borrower not found: ${contactId}`)

        const receivableLedger = await txContext.db.ledger_accounts.findFirst({
          where: { system_role: 'LOAN_RECEIVABLE', financial_space_id: spaceId, status: 'ACTIVE' }
        })
        if (!receivableLedger) throw new Error(`LOAN_RECEIVABLE ledger account not found for space ${spaceId}`)

        const template = await txContext.db.posting_template_definitions.findFirst({
          where: { code: 'LOAN_DISBURSEMENT', status: 'APPROVED' }
        })
        if (!template) throw new Error('Posting template LOAN_DISBURSEMENT not found or not APPROVED')

        // Postings: cash -A, receivable +A
        const entries = [
          { ledgerAccountId: sourceLedger.id, amount: -amount, entryRole: 'CASH_SOURCE' },
          { ledgerAccountId: receivableLedger.id, amount: amount, entryRole: 'LOAN_RECEIVABLE' }
        ]

        const result = await financialTransactionService.post(txContext, {
          type: 'LOAN_DISBURSEMENT',
          postingTemplateDefinitionId: template.id,
          entries,
          businessSnapshot: {
            sourceAccountId: sourceLedger.id.toString(),
            counterpartyContactId: contactId.toString(),
            rateBasis: rateBasis || 'UNSPECIFIED',
            description: description || null
          },
          options: {
            occurredAt: occurredAt?.toISOString() || new Date().toISOString(),
            metadata: { rateBasis: rateBasis || 'UNSPECIFIED' }
          }
        })

        // Create debt agreement (RECEIVABLE, OPEN)
        const debtAgreement = await txContext.db.debt_agreements.create({
          data: {
            financial_space_id: spaceId,
            origin_transaction_id: result.transaction.id,
            direction: 'RECEIVABLE',
            cash_ledger_account_id: sourceLedger.id,
            debt_ledger_account_id: receivableLedger.id,
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
          type: 'LOAN_DISBURSEMENT',
          amount: amount.toString(),
          rateBasis: rateBasis || 'UNSPECIFIED'
        }
      }
    })
  }
}

const loanService = new LoanService()
export default loanService
export { LoanService }
