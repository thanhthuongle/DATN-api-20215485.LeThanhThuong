import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'
import budgetRepository from '../repositories/budget.repository'

/**
 * BudgetService — V2 budget management.
 *
 * V2 uses a relational model: `budgets` and `budget_allocations` (one row per
 * category within a budget that shares a time range). This mirrors V1 semantics
 * where a budget bearer has overlapping time range and multiple category rows.
 *
 * Design contract: DEC-067 (money values are integer BIGINT), DEC-004 (V1/V2
 * route parity), implementation guardrails (module must not import Express).
 *
 * Budget creation is resource-only (no ledger/balance write), so it uses a
 * plain Prisma interactive transaction rather than the financial
 * TransactionManager. Atomicity prevents an orphan budget if allocation insert
 * fails after the budget row is created (finding W5-01).
 */

const assertAmount = (amount) => {
  if (amount === undefined || amount === null || amount < 0n) {
    throw new Error('Budget allocation amount must be a non-negative integer')
  }
}

class BudgetService {
  async listBudgets({ spaceId, isFinish = false }) {
    return budgetRepository.findBySpace(spaceId, { isFinish })
  }

  async getBudgetById({ id }) {
    return budgetRepository.findById(id)
  }

  async createBudgetAllocation({
    spaceId,
    categoryId,
    categoryName,
    icon,
    amount,
    repeat,
    startsAt,
    endsAt
  }) {
    assertAmount(amount)

    const prisma = getPrismaClient()

    return prisma.$transaction(async (tx) => {
      // Reuse an existing budget that already covers the time range (V1
      // one-budget bearer semantics); otherwise create a new budget row.
      let budget = await budgetRepository.findBySpaceAndTimeRange(spaceId, startsAt, endsAt, tx)

      const createNewBudget = !budget
      if (createNewBudget) {
        budget = await budgetRepository.createBudget({
          financial_space_id: spaceId,
          starts_at: startsAt,
          ends_at: endsAt,
          status: 'ACTIVE'
        }, tx)
      } else {
        const existing = await budgetRepository.findCategoryInBudget(budget.id, categoryId, tx)
        if (existing) {
          const error = new Error('Ngân sách muốn tạo đã tồn tại!')
          error.statusCode = 409
          throw error
        }
      }

      // Count is re-queried inside the transaction so ordinal stays consistent
      // even for a freshly created budget (avoids stale array-length read).
      const sourceOrdinal = createNewBudget
        ? 0
        : await budgetRepository.countAllocationsForBudget(budget.id, tx)

      return budgetRepository.createAllocation({
        budget_id: budget.id,
        category_id: categoryId,
        category_name_snapshot: categoryName,
        icon_snapshot: icon || null,
        amount,
        repeat_enabled: Boolean(repeat),
        source_ordinal: sourceOrdinal
      }, tx)
    })
  }
}

const budgetService = new BudgetService()
export default budgetService
export { BudgetService }
