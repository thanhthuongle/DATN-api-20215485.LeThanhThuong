import TransactionContext from '~/v2/modules/financial/core/TransactionContext'
import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'

class AccumulationRepository {
  async findBySpace(spaceId) {
    const prisma = getPrismaClient()
    return prisma.accumulations.findMany({
      where: { financial_space_id: spaceId, deleted_at: null },
      include: { ledger_accounts: true },
      orderBy: { created_at: 'desc' }
    })
  }

  async createWithLedger(txContext, data) {
    TransactionContext.assertTransactionContext(txContext)

    const accumulation = await txContext.db.accumulations.create({
      data: {
        financial_space_id: txContext.financialSpaceId,
        name: data.name,
        description: data.description || null,
        target_amount: data.targetAmount || BigInt(0),
        legacy_stored_balance: BigInt(0),
        starts_at: data.startsAt || new Date(),
        ends_at: data.endsAt,
        status: 'ACTIVE'
      }
    })

    const ledgerAccount = await txContext.db.ledger_accounts.create({
      data: {
        financial_space_id: txContext.financialSpaceId,
        kind: 'USER_BALANCE',
        normal_side: 'DEBIT',
        accumulation_id: accumulation.id,
        name: data.name,
        current_balance: BigInt(0),
        current_sequence: BigInt(0),
        status: 'ACTIVE'
      }
    })

    return { accumulation, ledgerAccount }
  }

  async findByPublicId(publicId) {
    const prisma = getPrismaClient()
    return prisma.accumulations.findFirst({
      where: { public_id: publicId, deleted_at: null },
      include: { ledger_accounts: true }
    })
  }
}

const accumulationRepository = new AccumulationRepository()
export default accumulationRepository
export { AccumulationRepository }
