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

  async createWithLedger(txContext, data) {
    TransactionContext.assertTransactionContext(txContext)

    const saving = await txContext.db.savings_accounts.create({
      data: {
        financial_space_id: txContext.financialSpaceId,
        source_account_id: data.sourceAccountId,
        bank_id: data.bankId || null,
        name: data.name,
        deposit_amount: data.depositAmount,
        interest_rate: data.interestRate,
        non_term_rate: data.nonTermRate || data.interestRate,
        term_months: data.termMonths || 0,
        interest_paid: data.interestPaid || 'MATURITY',
        term_ended: data.termEnded || 'CLOSE_ACCOUNT',
        start_date: data.startDate || new Date(),
        status: 'ACTIVE'
      }
    })

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

    return { saving, ledgerAccount }
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
