import transactionManager from '~/v2/modules/financial/core/TransactionManager'
import financialTransactionService from '~/v2/modules/financial/core/financialTransaction.service'
import { v4 as uuidv4 } from 'uuid'

/**
 * RepaymentService — V2 repayment via transaction core.
 *
 * Posting template: REPAYMENT
 * - cash source account: -P
 * - BORROWING_LIABILITY system account: +P
 *
 * Design contract: financial-invariant-matrix.md §4 (REPAYMENT template)
 * Decision: DEC-066, DEC-067
 * Full principal settlement only; interest = 0 (DEC-066).
 */
class RepaymentService {
  async repay({ actor, spaceId, sourceAccountId, debtAgreementId, occurredAt }) {
    const correlationId = uuidv4()
    const idempotencyKey = `repayment-${uuidv4()}`

    return transactionManager.execute({
      actor: { actorType: actor.type || 'USER', actorId: actor.id },
      financialSpaceId: spaceId,
      correlationId,
      idempotencyKey,
      fn: async (txContext) => {
        // 1. Find PAYABLE debt agreement, must be OPEN
        const debtAgreement = await txContext.db.debt_agreements.findFirst({
          where: { public_id: debtAgreementId, financial_space_id: spaceId, direction: 'PAYABLE', status: 'OPEN', deleted_at: null }
        })
        if (!debtAgreement) {
          throw new Error(`Open PAYABLE debt agreement not found: ${debtAgreementId}`)
        }

        const principalP = debtAgreement.outstanding_principal

        // 2. Find cash source ledger & verify balance
        const sourceLedger = await txContext.db.ledger_accounts.findFirst({
          where: { account_id: sourceAccountId, status: 'ACTIVE' }
        })
        if (!sourceLedger) throw new Error(`Source ledger account not found: ${sourceAccountId}`)
        if (sourceLedger.current_balance < principalP) {
          throw new Error(`Insufficient balance: have ${sourceLedger.current_balance}, need ${principalP}`)
        }

        // 3. Find BORROWING_LIABILITY system ledger
        const liabilityLedger = await txContext.db.ledger_accounts.findFirst({
          where: { id: debtAgreement.debt_ledger_account_id, status: 'ACTIVE' }
        })
        if (!liabilityLedger) throw new Error('Debt liability ledger account not found')

        const template = await txContext.db.posting_template_definitions.findFirst({
          where: { code: 'REPAYMENT', status: 'APPROVED' }
        })
        if (!template) throw new Error('Posting template REPAYMENT not found or not APPROVED')

        // 4. Postings: cash -P, liability +P; interest = 0 (DEC-066)
        const entries = [
          { ledgerAccountId: sourceLedger.id, amount: -principalP, entryRole: 'CASH_SOURCE' },
          { ledgerAccountId: liabilityLedger.id, amount: principalP, entryRole: 'BORROWING_LIABILITY' }
        ]

        const result = await financialTransactionService.post(txContext, {
          type: 'REPAYMENT',
          postingTemplateDefinitionId: template.id,
          entries,
          businessSnapshot: {
            sourceAccountId: sourceLedger.id.toString(),
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
            cash_ledger_account_id: sourceLedger.id,
            principal_amount: principalP,
            interest_amount: BigInt(0),
            occurred_at: occurredAt || new Date()
          }
        })

        // 6. Settle the debt agreement (full settlement, outstanding → 0)
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
          type: 'REPAYMENT',
          amount: principalP.toString(),
          interest: '0'
        }
      }
    })
  }
}

const repaymentService = new RepaymentService()
export default repaymentService
export { RepaymentService }
