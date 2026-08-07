import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BudgetService } from '~/v2/modules/budget/services/budget.service'
import budgetRepository from '~/v2/modules/budget/repositories/budget.repository'
import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'

// Mock the Prisma client: `$transaction` invokes the callback with a `tx`
// object that repository calls pass through (transaction client passthrough).
const tx = { __tx: true }
vi.mock('~/v2/infrastructure/database/prismaClient', () => ({
  getPrismaClient: vi.fn(() => ({ $transaction: vi.fn(async (fn) => fn(tx)) }))
}))

describe('BudgetService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(getPrismaClient).mockClear()
  })

  describe('createBudgetAllocation', () => {
    it('throws 409 when category already exists in an overlapping budget', async () => {
      const existingBudget = { id: BigInt(1), budget_allocations: [{ category_id: BigInt(10) }] }
      vi.spyOn(budgetRepository, 'findBySpaceAndTimeRange').mockResolvedValueOnce(existingBudget)
      vi.spyOn(budgetRepository, 'findCategoryInBudget').mockResolvedValueOnce({ category_id: BigInt(10) })
      const createAllocationSpy = vi.spyOn(budgetRepository, 'createAllocation')

      const service = new BudgetService()
      await expect(service.createBudgetAllocation({
        spaceId: BigInt(1),
        categoryId: BigInt(10),
        categoryName: 'Food',
        amount: BigInt(500000),
        startsAt: new Date('2026-08-01T00:00:00Z'),
        endsAt: new Date('2026-08-31T00:00:00Z')
      })).rejects.toMatchObject({ statusCode: 409 })

      expect(createAllocationSpy).not.toHaveBeenCalled()
    })

    it('creates a new budget row when none overlaps the time range', async () => {
      const newBudget = { id: BigInt(1) }
      vi.spyOn(budgetRepository, 'findBySpaceAndTimeRange').mockResolvedValueOnce(null)
      const createBudgetSpy = vi.spyOn(budgetRepository, 'createBudget').mockResolvedValueOnce(newBudget)
      const createAllocationSpy = vi.spyOn(budgetRepository, 'createAllocation')
        .mockResolvedValueOnce({ public_id: 'alloc-1' })

      const service = new BudgetService()
      const result = await service.createBudgetAllocation({
        spaceId: BigInt(1),
        categoryId: BigInt(10),
        categoryName: 'Food',
        amount: BigInt(500000),
        startsAt: new Date('2026-08-01T00:00:00Z'),
        endsAt: new Date('2026-08-31T00:00:00Z')
      })

      expect(createBudgetSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE' }), tx)
      expect(createAllocationSpy).toHaveBeenCalledWith(expect.objectContaining({
        budget_id: BigInt(1),
        category_id: BigInt(10),
        amount: BigInt(500000),
        source_ordinal: 0
      }), tx)
      expect(result.public_id).toBe('alloc-1')
    })

    it('adds an allocation to an existing budget with next ordinal', async () => {
      const existingBudget = { id: BigInt(5), budget_allocations: [{ category_id: BigInt(10) }] }
      vi.spyOn(budgetRepository, 'findBySpaceAndTimeRange').mockResolvedValueOnce(existingBudget)
      vi.spyOn(budgetRepository, 'findCategoryInBudget').mockResolvedValueOnce(null)
      vi.spyOn(budgetRepository, 'countAllocationsForBudget').mockResolvedValueOnce(1)
      const createAllocationSpy = vi.spyOn(budgetRepository, 'createAllocation')
        .mockResolvedValueOnce({ public_id: 'alloc-2' })

      const service = new BudgetService()
      await service.createBudgetAllocation({
        spaceId: BigInt(1),
        categoryId: BigInt(20),
        categoryName: 'Transport',
        amount: BigInt(200000),
        startsAt: new Date('2026-08-01T00:00:00Z'),
        endsAt: new Date('2026-08-31T00:00:00Z')
      })

      expect(createAllocationSpy).toHaveBeenCalledWith(expect.objectContaining({
        budget_id: BigInt(5),
        source_ordinal: 1
      }), tx)
    })

    it('rejects negative amounts before opening a transaction', async () => {
      const service = new BudgetService()
      await expect(service.createBudgetAllocation({
        spaceId: BigInt(1),
        categoryId: BigInt(10),
        categoryName: 'Food',
        amount: -1n,
        startsAt: new Date('2026-08-01T00:00:00Z'),
        endsAt: new Date('2026-08-31T00:00:00Z')
      })).rejects.toThrow(/non-negative/)
      expect(getPrismaClient).toHaveBeenCalledTimes(0)
    })
  })

  describe('listBudgets', () => {
    it('delegates to repository with isFinish filter', async () => {
      const spy = vi.spyOn(budgetRepository, 'findBySpace').mockResolvedValueOnce([])
      const service = new BudgetService()
      await service.listBudgets({ spaceId: BigInt(1), isFinish: true })
      expect(spy).toHaveBeenCalledWith(BigInt(1), { isFinish: true })
    })
  })
})
