import transactionManager from '~/v2/modules/financial/core/TransactionManager'
import financialTransactionService from '~/v2/modules/financial/core/financialTransaction.service'
import savingRepository from '../repositories/saving.repository'
import { v4 as uuidv4 } from 'uuid'

/**
 * SavingService — V2 savings account create + SAVING_DEPOSIT via transaction core.
 *
 * Posting template: SAVING_DEPOSIT
 * - source -P, saving +P
 *
 * Design contract: interest-rate-rules.md §2, financial-invariant-matrix.md §4
 * Decision: DEC-021, DEC-067
 */
class SavingService {
  async createSaving({ actor, spaceId, sourceAccountId, bankId, name, description, principalAmount, annualRate, nonTermAnnualRate, termMonths, interestSchedule, maturityAction, startsAt }) {
    const correlationId = uuidv4()
    const idempotencyKey = `saving-create-${uuidv4()}`

    return transactionManager.execute({
      actor: { actorType: actor.type || 'USER', actorId: actor.id },
      financialSpaceId: spaceId,
      correlationId,
      idempotencyKey,
      fn: async (txContext) => {
        const { saving, ledgerAccount } = await savingRepository.createWithLedger(txContext, {
          bankId,
          name,
          description,
          principalAmount: principalAmount || BigInt(0),
          annualRate: annualRate || '0',
          nonTermAnnualRate: nonTermAnnualRate || annualRate || '0',
          termMonths: termMonths || 0,
          interestSchedule: interestSchedule || 'MATURITY',
          maturityAction: maturityAction || 'CLOSE_ACCOUNT',
          startsAt
        })

        // Post SAVING_DEPOSIT: source -P, saving +P (only if P > 0, DEC-067)
        let depositResult = null
        if (principalAmount && principalAmount > BigInt(0)) {
          const sourceLedger = await txContext.db.ledger_accounts.findFirst({
            where: { account_id: sourceAccountId, status: 'ACTIVE' }
          })
          if (!sourceLedger) throw new Error(`Source ledger account not found: ${sourceAccountId}`)
          if (sourceLedger.current_balance < principalAmount) {
            throw new Error(`Insufficient balance: have ${sourceLedger.current_balance}, need ${principalAmount}`)
          }

          const template = await txContext.db.posting_template_definitions.findFirst({
            where: { code: 'SAVING_DEPOSIT', status: 'APPROVED' }
          })
          if (!template) throw new Error('Posting template SAVING_DEPOSIT not found')

          depositResult = await financialTransactionService.post(txContext, {
            type: 'SAVING_DEPOSIT',
            postingTemplateDefinitionId: template.id,
            entries: [
              { ledgerAccountId: sourceLedger.id, amount: -principalAmount, entryRole: 'SOURCE' },
              { ledgerAccountId: ledgerAccount.id, amount: principalAmount, entryRole: 'SAVING' }
            ],
            businessSnapshot: {
              sourceAccountId: sourceLedger.id.toString(),
              savingAccountId: saving.id.toString(),
              annualRate: annualRate?.toString() || '0'
            },
            options: {
              occurredAt: new Date().toISOString(),
              metadata: { savingAccountId: saving.id.toString() }
            }
          })
        }

        return {
          publicId: saving.public_id,
          name: saving.name,
          principalAmount: saving.principal_amount.toString(),
          annualRate: saving.annual_rate?.toString() || '0',
          interestSchedule: saving.interest_schedule,
          maturityAction: saving.maturity_action,
          status: saving.status,
          depositTransactionId: depositResult ? depositResult.transaction.public_id : null
        }
      }
    })
  }

  async getSavingsBySpace(spaceId) {
    return savingRepository.findBySpace(spaceId)
  }

  async getSavingByPublicId(publicId) {
    return savingRepository.findByPublicId(publicId)
  }
}

const savingService = new SavingService()
export default savingService
export { SavingService }

