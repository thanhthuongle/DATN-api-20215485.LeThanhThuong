import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FinancialQueryService } from '~/v2/modules/financial/query/financialQuery.service'
import financialQueryRepository from '~/v2/modules/financial/query/financialQuery.repository'

describe('FinancialQueryService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('getSpaceBalanceSummary', () => {
    it('sums balances and buckets by kind', async () => {
      vi.spyOn(financialQueryRepository, 'findLedgerAccountsBySpace').mockResolvedValueOnce([
        { kind: 'USER_BALANCE', current_balance: 1000n },
        { kind: 'USER_BALANCE', current_balance: 2500n },
        { kind: 'SYSTEM', current_balance: -500n }
      ])

      const service = new FinancialQueryService()
      const result = await service.getSpaceBalanceSummary(BigInt(1))
      expect(result.totalBalance).toBe('3000')
      expect(result.byKind.USER_BALANCE).toBe('3500')
      expect(result.byKind.SYSTEM).toBe('-500')
    })
  })

  describe('getCategorySpendReport', () => {
    it('aggregates POSTED transactions by category with integer amounts', async () => {
      vi.spyOn(financialQueryRepository, 'findTransactionsForReport').mockResolvedValueOnce([
        { type: 'EXPENSE', amount: 100000n, categories: { public_id: 'cat-1' } },
        { type: 'EXPENSE', amount: 50000n, categories: { public_id: 'cat-1' } },
        { type: 'INCOME', amount: 300000n, categories: { public_id: 'cat-2' } },
        { type: 'TRANSFER', amount: 70000n, categories: null }
      ])

      const service = new FinancialQueryService()
      const result = await service.getCategorySpendReport(BigInt(1), {})

      expect(result.totalOutflow).toBe('150000')
      expect(result.totalInflow).toBe('300000')
      const cat1 = result.categories.find((c) => c.categoryId === 'cat-1')
      expect(cat1.outflow).toBe('150000')
    })
  })

  describe('getTransactionHistory', () => {
    it('delegates with normalized pagination', async () => {
      const spy = vi.spyOn(financialQueryRepository, 'findTransactionHistoryBySpace')
        .mockResolvedValueOnce({ rows: [], total: 0 })
      const service = new FinancialQueryService()
      await service.getTransactionHistory(BigInt(1), { from: '2026-08-01', to: '2026-08-31', limit: 100 })
      expect(spy).toHaveBeenCalledWith(BigInt(1), {
        from: new Date('2026-08-01'),
        to: new Date('2026-08-31'),
        limit: 100,
        offset: 0
      })
    })
  })
})
