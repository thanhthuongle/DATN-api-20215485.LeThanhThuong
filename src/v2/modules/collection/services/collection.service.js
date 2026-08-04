import transactionManager from '~/v2/modules/financial/core/TransactionManager'
import financialTransactionService from '~/v2/modules/financial/core/financialTransaction.service'
import { v4 as uuidv4 } from 'uuid'

/**
 * CollectionService — V2 collection via transaction core.
 *
 * Posting template: COLLECTION
 * - cash target account: +P
 * - LOAN_RECEIVABLE system account: -P
 *
 * Design contract: financial-invariant-matrix.md §4 (COLLECTION template)
 * Decision: DEC-066, DEC-067
 * Full principal settlement only; interest = 0 (DEC-066).
 */
class CollectionService {
  async collect({ actor, spaceId, targetAccountId, debtAgreementId, occurredAt }) {
    const correlationId = uuidv4()
    const idempotencyKey = `collection-${uuidv4()}`

    return transactionManager.execute({
      actor: { actorType: actor.type || 'USER', actorId: actor.id },
      financialSpaceId: spaceId,
      correlationId,
      idempotencyKey,
      fn: async (txContext) => {
        // 1. Find RECEIVABLE debt agreement, must be OPEN
        const debtAgreement = await txContext.db.debt_agreements.findFirst({
          where: { public_id: debtAgreementId, financial_space_id: spaceId, direction: 'RECEIVABLE', status: 'OPEN', deleted_at: null }
        })
        if (!debtAgreement) {
          throw new Error(`Open RECEIVABLE debt agreement not found: ${debtAgreementId}`)
        }

        const principalP = debtAgreement.outstanding_principal

        // 2. Find cash target ledger
        const targetLedger = await txContext.db.ledger_accounts.findFirst({
          where: { account_id: targetAccountId, status: 'ACTIVE' }
        })
        if (!targetLedger) throw new Error(`Target ledger account not found: ${targetAccountId}`)

        // 3. Find LOAN_RECEIVABLE system ledger
        const receivableLedger = await txContext.db.ledger_accounts.findFirst({
          where: { id: debtAgreement.debt_ledger_account_id, status: 'ACTIVE' }
        })
        if (!receivableLedger) throw new Error('Loan receivable ledger account not found')

        const template = await txContext.db.posting_template_definitions.findFirst({
          where: { code: 'COLLECTION', status: 'APPROVED' }
        })
        if (!template) throw new Error('Posting template COLLECTION not found or not APPROVED')

        // 4. Postings: cash +P, receivable -P; interest = 0 (DEC-066)
        const entries = [
          { ledgerAccountId: targetLedger.id, amount: principalP, entryRole: 'CASH_TARGET' },
          { ledgerAccountId: receivableLedger.id, amount: -principalP, entryRole: 'LOAN_RECEIVABLE' }
        ]

        const result = await financialTransactionService.post(txContext, {
          type: 'COLLECTION',
          postingTemplateDefinitionId: template.id,
          entries,
          businessSnapshot: {
            targetAccountId: targetLedger.id.toString(),
            debtAgreementId: debtAgreement.id.toString(),
            principal: principalP.toString(),
            interest: '0'
          },
          options: {
            occurredAt: occurredAt?.toISOString() || new Date().toISOString(),
            metadata: { interest: '0' }
          }
        })

        // 5. Create debt settlement record (full principal, interest 0)
        await txContext.db.debt_settlements.create({
          data: {
            financial_space_id: spaceId,
            financial_transaction_id: result.transaction.id,
            debt_agreement_id: debtAgreement.id,
            cash_ledger_account_id: targetLedger.id,
            principal_amount: principalP,
            interest_amount: BigInt(0),
            occurred_at: occurredAt || new Date()
          }
        })

        // 6. Settle the debt agreement
        await txContext.db.debt_agreements.update({
          where: { id: debtAgreement.id },
          data: {
            status: 'SETTLED',
            outstanding_principal: BigInt(0),
            settled_at: new Date()
          }
        })

        return {
          transactionId: result.transaction.public_id,
          debtAgreementId: debtAgreement.public_id,
          type: 'COLLECTION',
          amount: principalP.toString(),
          interest: '0'
        }
      }
    })
  }
}

const collectionService = new CollectionService()
export default collectionService
export { CollectionService }
