import transactionManager from '~/v2/modules/financial/core/TransactionManager'
import financialTransactionService from '~/v2/modules/financial/core/financialTransaction.service'
import idempotencyService from '~/v2/modules/financial/core/idempotency.service'
import { IdempotencyResult } from '~/v2/modules/financial/core/idempotency.service'
import interestCalculator from './interestCalculator'
import { v4 as uuidv4 } from 'uuid'
import { createHash } from 'node:crypto'

/**
 * SavingInterestService — V2 saving interest accrual/payout via transaction core.
 *
 * Posting templates (financial-invariant-matrix.md §4):
 * - SAVING_INTEREST_MONTHLY: INTEREST_EXPENSE -I; saving +I; saving -I; target +I
 *   (monthly payout: interest moved from saving to target, saving net 0)
 * - SAVING_INTEREST_MATURITY: INTEREST_EXPENSE -I; saving +I (retained in saving)
 *
 * Decision: DEC-021, DEC-032, DEC-069
 * Idempotency: deterministic key per saving+period, resolved BEFORE posting
 *   to prevent double accrual on job retry (transaction-runtime.md §3).
 */
class SavingInterestService {
  /**
   * Accrue + payout a single month of interest (MONTHLY schedule).
   * Computes interest for the CURRENT period only (not full term).
   */
  async accrueMonthly({ actor, spaceId, savingId, targetAccountId, period, now }) {
    const correlationId = uuidv4()
    const operation = 'SAVING_INTEREST_MONTHLY'
    const idempotencyKey = `saving-interest-monthly-${savingId}-${period?.periodOrdinal || 1}`

    return transactionManager.execute({
      actor: { actorType: 'JOB', actorId: actor.id || 'saving-interest-job' },
      financialSpaceId: spaceId,
      correlationId,
      idempotencyKey,
      fn: async (txContext) => {
        const saving = await txContext.db.savings_accounts.findFirst({
          where: { id: savingId, status: 'ACTIVE', deleted_at: null }
        })
        if (!saving) throw new Error(`Active saving not found: ${savingId}`)

        // Single-period interest (NOT full term) using actual days of this period
        const periodStart = period?.start || saving.starts_at
        const periodEnd = period?.end || now || new Date()
        const interest = interestCalculator.interestByActualDays({
          principal: saving.principal_amount,
          annualRatePercent: saving.annual_rate,
          startDate: periodStart,
          endDate: periodEnd
        })

        // Zero interest → no write, no idempotency slot claimed (return clean)
        if (interest === BigInt(0)) {
          return { interest: '0', periodOrdinal: period?.periodOrdinal || 1 }
        }

        // Idempotency: claim only when a write will happen (prevents IN_PROGRESS leak)
        const idem = await idempotencyService.resolveIdempotency(txContext, {
          operation,
          idempotencyKey,
          requestHash: createHash('sha256').update(`${savingId}|${period?.periodOrdinal || 1}`).digest('hex')
        })
        if (idem.result !== IdempotencyResult.NEW) {
          throw new Error(`Idempotency conflict for ${operation}: ${idem.result}`)
        }

        const expenseLedger = await txContext.db.ledger_accounts.findFirst({
          where: { system_role: 'INTEREST_EXPENSE', financial_space_id: spaceId, status: 'ACTIVE' }
        })
        if (!expenseLedger) throw new Error(`INTEREST_EXPENSE not found for space ${spaceId}`)

        const savingLedger = await txContext.db.ledger_accounts.findFirst({
          where: { saving_account_id: savingId, status: 'ACTIVE' }
        })
        if (!savingLedger) throw new Error(`Saving ledger account not found: ${savingId}`)

        const targetLedger = await txContext.db.ledger_accounts.findFirst({
          where: { account_id: targetAccountId, status: 'ACTIVE' }
        })
        if (!targetLedger) throw new Error(`Target ledger account not found: ${targetAccountId}`)

        const template = await txContext.db.posting_template_definitions.findFirst({
          where: { code: 'SAVING_INTEREST_MONTHLY', status: 'APPROVED' }
        })
        if (!template) throw new Error('Posting template SAVING_INTEREST_MONTHLY not found')

        // Full monthly payout pair: expense -I, saving +I, saving -I, target +I (sum 0)
        const res = await financialTransactionService.post(txContext, {
          type: 'SAVING_INTEREST_MONTHLY',
          postingTemplateDefinitionId: template.id,
          entries: [
            { ledgerAccountId: expenseLedger.id, amount: -interest, entryRole: 'INTEREST_EXPENSE' },
            { ledgerAccountId: savingLedger.id, amount: interest, entryRole: 'SAVING_ACCRUAL' },
            { ledgerAccountId: savingLedger.id, amount: -interest, entryRole: 'SAVING_PAYOUT' },
            { ledgerAccountId: targetLedger.id, amount: interest, entryRole: 'TARGET' }
          ],
          businessSnapshot: {
            savingId: savingId.toString(),
            principal: saving.principal_amount.toString(),
            annualRate: saving.annual_rate?.toString() || '0',
            interest: interest.toString(),
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
            periodOrdinal: period?.periodOrdinal || 1
          },
          options: { occurredAt: (now || new Date()).toISOString() }
        })

        // Complete idempotency slot + record period (ordinal >= 1)
        await idempotencyService.completeSlot(txContext, {
          idempotencyRecordId: idem.record.id,
          resourceType: 'saving_period',
          resourcePublicId: res.transaction.public_id,
          responseBody: { interest: interest.toString() },
          responseStatus: 200
        })
        await txContext.db.saving_periods.create({
          data: {
            saving_account_id: savingId,
            period_ordinal: period?.periodOrdinal || 1,
            action: 'MONTHLY_INTEREST',
            due_at: period?.end || new Date(),
            status: 'COMPLETED',
            financial_transaction_id: res.transaction.id,
            idempotency_key: idempotencyKey,
            completed_at: new Date()
          }
        })

        return { interest: interest.toString(), periodOrdinal: period?.periodOrdinal || 1 }
      }
    })
  }


  /**
   * Accrue maturity interest and retain in saving (payout happens per action).
   */
  async accrueMaturity({ actor, spaceId, savingId, now }) {
    const correlationId = uuidv4()
    const operation = 'SAVING_INTEREST_MATURITY'
    const idempotencyKey = `saving-interest-maturity-${savingId}`

    return transactionManager.execute({
      actor: { actorType: 'JOB', actorId: actor.id || 'saving-maturity-job' },
      financialSpaceId: spaceId,
      correlationId,
      idempotencyKey,
      fn: async (txContext) => {
        const saving = await txContext.db.savings_accounts.findFirst({
          where: { id: savingId, status: 'ACTIVE', deleted_at: null }
        })
        if (!saving) throw new Error(`Active saving not found: ${savingId}`)

        const { interest, method } = interestCalculator.computeInterest({
          principal: saving.principal_amount,
          annualRatePercent: saving.annual_rate,
          nonTermAnnualRatePercent: saving.non_term_annual_rate,
          termMonths: saving.term_months,
          startsAt: saving.starts_at,
          now
        })

        // Zero interest → no write, no idempotency slot claimed
        if (interest === BigInt(0)) {
          return { interest: '0', method }
        }

        // Idempotency: claim only when a write will happen
        const idem = await idempotencyService.resolveIdempotency(txContext, {
          operation,
          idempotencyKey,
          requestHash: createHash('sha256').update(`maturity|${savingId}`).digest('hex')
        })
        if (idem.result !== IdempotencyResult.NEW) {
          throw new Error(`Idempotency conflict for ${operation}: ${idem.result}`)
        }

        const expenseLedger = await txContext.db.ledger_accounts.findFirst({
          where: { system_role: 'INTEREST_EXPENSE', financial_space_id: spaceId, status: 'ACTIVE' }
        })
        if (!expenseLedger) throw new Error(`INTEREST_EXPENSE not found for space ${spaceId}`)

        const savingLedger = await txContext.db.ledger_accounts.findFirst({
          where: { saving_account_id: savingId, status: 'ACTIVE' }
        })
        if (!savingLedger) throw new Error(`Saving ledger account not found: ${savingId}`)

        const template = await txContext.db.posting_template_definitions.findFirst({
          where: { code: 'SAVING_INTEREST_MATURITY', status: 'APPROVED' }
        })
        if (!template) throw new Error('Posting template SAVING_INTEREST_MATURITY not found')

        // Recognize maturity interest: expense -I, saving +I (retained in saving)
        const res = await financialTransactionService.post(txContext, {
          type: 'SAVING_INTEREST_MATURITY',
          postingTemplateDefinitionId: template.id,
          entries: [
            { ledgerAccountId: expenseLedger.id, amount: -interest, entryRole: 'INTEREST_EXPENSE' },
            { ledgerAccountId: savingLedger.id, amount: interest, entryRole: 'SAVING' }
          ],
          businessSnapshot: {
            savingId: savingId.toString(),
            principal: saving.principal_amount.toString(),
            annualRate: saving.annual_rate?.toString() || '0',
            method,
            interest: interest.toString()
          },
          options: { occurredAt: (now || new Date()).toISOString() }
        })

        await idempotencyService.completeSlot(txContext, {
          idempotencyRecordId: idem.record.id,
          resourceType: 'saving_period',
          resourcePublicId: res.transaction.public_id,
          responseBody: { interest: interest.toString() },
          responseStatus: 200
        })

        await txContext.db.saving_periods.create({
          data: {
            saving_account_id: savingId,
            period_ordinal: 1,
            action: 'MATURITY_INTEREST',
            due_at: now || new Date(),
            status: 'COMPLETED',
            financial_transaction_id: res.transaction.id,
            idempotency_key: idempotencyKey,
            completed_at: new Date()
          }
        })

        return { interest: interest.toString(), method }
      }
    })
  }
}

const savingInterestService = new SavingInterestService()
export default savingInterestService
export { SavingInterestService }
