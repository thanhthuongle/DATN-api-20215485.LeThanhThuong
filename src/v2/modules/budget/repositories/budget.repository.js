import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'

class BudgetRepository {
  // All mutating ops accept an optional tx (Prisma TransactionClient) so the
  // service can wrap create-budget + create-allocation in one atomic unit and
  // avoid orphan budgets on partial failure (finding W5-01).
  _client(tx) {
    return tx || getPrismaClient()
  }

  async findBySpaceAndTimeRange(spaceId, startsAt, endsAt, tx) {
    const prisma = this._client(tx)
    return prisma.budgets.findFirst({
      where: {
        financial_space_id: spaceId,
        starts_at: startsAt,
        ends_at: endsAt,
        deleted_at: null
      },
      include: { budget_allocations: { include: { categories: true } } }
    })
  }

  async findBySpace(spaceId, { isFinish = false } = {}, tx) {
    const prisma = this._client(tx)
    const now = new Date()
    return prisma.budgets.findMany({
      where: {
        financial_space_id: spaceId,
        deleted_at: null,
        ...(isFinish
          ? { ends_at: { lt: now } }
          : {
            OR: [
              { status: 'ACTIVE' },
              { ends_at: { gte: now } }
            ]
          })
      },
      orderBy: { starts_at: 'desc' },
      include: { budget_allocations: { include: { categories: true } } }
    })
  }

  async createBudget(data, tx) {
    const prisma = this._client(tx)
    return prisma.budgets.create({ data, include: { budget_allocations: true } })
  }

  async createAllocation(data, tx) {
    const prisma = this._client(tx)
    return prisma.budget_allocations.create({
      data,
      include: { categories: true }
    })
  }

  async countAllocationsForBudget(budgetId, tx) {
    const prisma = this._client(tx)
    return prisma.budget_allocations.count({ where: { budget_id: budgetId } })
  }

  async findCategoryInBudget(budgetId, categoryId, tx) {
    const prisma = this._client(tx)
    return prisma.budget_allocations.findFirst({
      where: { budget_id: budgetId, category_id: categoryId }
    })
  }

  async findById(id, tx) {
    const prisma = this._client(tx)
    return prisma.budgets.findFirst({
      where: { id, deleted_at: null },
      include: { budget_allocations: { include: { categories: true } } }
    })
  }
}

const budgetRepository = new BudgetRepository()
export default budgetRepository
export { BudgetRepository }
