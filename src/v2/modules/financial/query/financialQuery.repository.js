import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'

/**
 * FinancialQueryRepository — read-only query access for reports and read models.
 *
 * Phase 8 (reporting/analysis). These methods NEVER write ledger/balance and
 * NEVER use a transaction context; they are pure reads for the current actor's
 * financial spaces. All amounts are returned as BigInt strings for API mapping.
 */
class FinancialQueryRepository {
  // --- Ledger / balance summary -------------------------------------------

  async findLedgerAccountsBySpace(spaceId) {
    const prisma = getPrismaClient()
    return prisma.ledger_accounts.findMany({
      where: { financial_space_id: spaceId },
      orderBy: [{ kind: 'asc' }, { id: 'asc' }]
    })
  }

  async findActiveLedgerAccountsBySpace(spaceId) {
    const prisma = getPrismaClient()
    return prisma.ledger_accounts.findMany({
      where: { financial_space_id: spaceId, status: 'ACTIVE' },
      orderBy: { id: 'asc' }
    })
  }

  // --- Transaction history --------------------------------------------------

  async findTransactionHistoryBySpace(spaceId, { from, to, limit = 50, offset = 0 }) {
    const prisma = getPrismaClient()
    const where = {
      financial_space_id: spaceId,
      ...(from || to
        ? {
          occurred_at: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {})
          }
        }
        : {})
    }

    const [rows, total] = await Promise.all([
      prisma.financial_transactions.findMany({
        where,
        orderBy: { occurred_at: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.financial_transactions.count({ where })
    ])

    return { rows, total }
  }

  async findDetailByTransactionId(transactionId) {
    const prisma = getPrismaClient()
    return prisma.financial_transactions.findUnique({
      where: { id: transactionId },
      include: {
        ledger_entries: true,
        transaction_expense_details: true,
        transaction_income_details: true,
        transaction_transfer_details: true,
        transaction_saving_details: true,
        categories: true
      }
    })
  }

  // --- Aggregation / reports -------------------------------------------------

  async findTransactionsForReport(spaceId, { from, to }) {
    const prisma = getPrismaClient()
    return prisma.financial_transactions.findMany({
      where: {
        financial_space_id: spaceId,
        status: 'POSTED',
        ...(from || to
          ? {
            occurred_at: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {})
            }
          }
          : {})
      },
      include: { categories: true },
      orderBy: { occurred_at: 'asc' }
    })
  }
}

const financialQueryRepository = new FinancialQueryRepository()
export default financialQueryRepository
export { FinancialQueryRepository }
