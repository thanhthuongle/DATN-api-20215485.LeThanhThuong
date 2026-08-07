import { describe, expect, it, vi } from 'vitest'

const createMockDb = ({ transactions = [], accounts = [], rawSpaceTotals = [] } = {}) => {
  const delegate = {
    count: vi.fn(() => Promise.resolve(1)),
    findMany: vi.fn(async () => transactions)
  }
  void accounts
  return {
    migration_source_records: delegate,
    financial_transactions: {
      findMany: vi.fn(async () => transactions)
    },
    ledger_accounts: {
      findMany: vi.fn(async () => accounts)
    },
    $queryRaw: vi.fn(async () => rawSpaceTotals)
  }
}

vi.mock('~/v2/infrastructure/database/prismaClient', () => ({
  getPrismaClient: () => mockedDb
}))

import { ReconciliationEngine } from '../../../src/v2/modules/migration/services/reconciliationEngine.service'

let mockedDb

describe('reconciliationEngine.service', () => {
  it('detects an unbalanced posting group', async () => {
    mockedDb = createMockDb({
      transactions: [{
        id: 1n,
        public_id: 'tx-1',
        status: 'POSTED',
        ledger_entries: [{ amount: 100n }, { amount: -90n }]
      }]
    })
    const engine = new ReconciliationEngine()
    const result = await engine.checkUnbalancedPostings()
    expect(result.unbalancedCount).toBe(1)
    expect(result.unbalanced[0].reason).toBe('UNBALANCED')
  })

  it('accepts a balanced posting group with >= 2 entries', async () => {
    mockedDb = createMockDb({
      transactions: [{
        id: 1n,
        public_id: 'tx-1',
        status: 'POSTED',
        ledger_entries: [{ amount: 100n }, { amount: -100n }]
      }]
    })
    const engine = new ReconciliationEngine()
    const result = await engine.checkUnbalancedPostings()
    expect(result.unbalancedCount).toBe(0)
  })

  it('flags a ledger account whose current balance differs from its last entry', async () => {
    mockedDb = createMockDb({
      accounts: [{
        id: 1n,
        public_id: 'acc-1',
        current_balance: 105n,
        ledger_entries: [
          { account_sequence: 1, amount: 100n, balance_after: 100n }
        ]
      }]
    })
    const engine = new ReconciliationEngine()
    const result = await engine.checkEntryChain()
    expect(result.issueCount).toBe(1)
  })

  it('detects non-zero space totals', async () => {
    mockedDb = createMockDb({
      rawSpaceTotals: [{ financial_space_id: 1n, net: 15n }]
    })
    const engine = new ReconciliationEngine()
    const result = await engine.checkSpaceTotals()
    expect(result.unbalancedSpaces).toHaveLength(1)
  })

  it('aggregates disposition totals for a run', async () => {
    mockedDb = createMockDb()
    const engine = new ReconciliationEngine()
    const summary = await engine.dispositionSummary(1n)
    expect(summary.sourceCount).toBeGreaterThan(0)
  })
})