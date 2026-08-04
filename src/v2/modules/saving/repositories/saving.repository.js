import TransactionContext from '~/v2/modules/financial/core/TransactionContext'
import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'

class SavingRepository {
  async findBySpace(spaceId) {
    const prisma = getPrismaClient()
    return prisma.savings_accounts.findMany({
      where: { financial_space_id: spaceId, deleted_at: null },
      include: { ledger_accounts: true, saving_periods: true },
      orderBy: { created_at: 'desc' }
    })
  }

  /**
   * Create savings account + linked ledger_account with correct schema fields.
   * Use Prisma Decimal for rates (DECIMAL(7,4)) per interest-rate-rules.md.
   */
  async createWithLedger(txContext, data) {
    TransactionContext.assertTransactionContext(txContext)

    const saving = await txContext.db.savings_accounts.create({
      data: {
        financial_space_id: txContext.financialSpaceId,
        bank_id: data.bankId || null,
        name: data.name,
        description: data.description || null,
        principal_amount: data.principalAmount || BigInt(0),
        annual_rate: data.annualRate,
        non_term_annual_rate: data.nonTermAnnualRate || data.annualRate,
        day_count_convention: 'ACTUAL_365',
        rounding_mode: 'HALF_UP',
        starts_at: data.startsAt || new Date(),
        term_months: data.termMonths || 0,
        interest_schedule: data.interestSchedule || 'MATURITY',
        maturity_action: data.maturityAction || 'CLOSE_ACCOUNT',
        status: 'ACTIVE'
      }
    })

    // Create linked ledger account
    const ledgerAccount = await txContext.db.ledger_accounts.create({
      data: {
        financial_space_id: txContext.financialSpaceId,
        kind: 'USER_BALANCE',
        normal_side: 'DEBIT',
        saving_account_id: saving.id,
        name: data.name,
        current_balance: BigInt(0),
        current_sequence: BigInt(0),
        status: 'ACTIVE'
      }
    })

    // Link funding + interest target to the saving's own ledger account
    const updatedSaving = await txContext.db.savings_accounts.update({
      where: { id: saving.id },
      data: {
        funding_ledger_account_id: ledgerAccount.id,
        interest_target_ledger_account_id: ledgerAccount.id
      }
    })

    return { saving: updatedSaving, ledgerAccount }
  }

  async findByPublicId(publicId) {
    const prisma = getPrismaClient()
    return prisma.savings_accounts.findFirst({
      where: { public_id: publicId, deleted_at: null },
      include: { ledger_accounts: true, saving_periods: true }
    })
  }
}

const savingRepository = new SavingRepository()
export default savingRepository

export { SavingRepository }
