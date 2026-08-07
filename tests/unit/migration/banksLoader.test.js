import { beforeEach, describe, expect, it, vi } from 'vitest'

const banks = []
const records = []

const createPrismaMock = () => ({
  migration_source_records: {
    findMany: vi.fn(async () => records.slice())
  },
  banks: {
    findUnique: vi.fn(async ({ where }) => banks.find((b) => b.legacy_mongo_id === where.legacy_mongo_id) || null),
    create: vi.fn(async ({ data }) => {
      const row = { id: BigInt(banks.length + 1), public_id: `bank-${banks.length + 1}`, ...data }
      banks.push(row)
      return row
    })
  },
  $transaction: async (fn) => fn(createPrismaMock())
})

vi.mock('~/v2/infrastructure/database/prismaClient', () => ({
  getPrismaClient: () => mockedDb
}))

import { BanksLoader } from '../../../src/v2/modules/migration/loaders/banksLoader'

let mockedDb
const runRepo = {
  markSourceLoaded: vi.fn().mockResolvedValue({}),
  markSourceRejected: vi.fn().mockResolvedValue({})
}

describe('banksLoader', () => {
  beforeEach(() => {
    banks.length = 0
    records.length = 0
    mockedDb = createPrismaMock()
  })

  it('loads a staged bank and marks the source record loaded', async () => {
    records.push({
      source_legacy_id: 'a'.repeat(24),
      raw_document: { code: 'VCB', name: 'Vietcombank', logo: 'https://x/logo.png' },
      target_public_id: null
    })
    const loader = new BanksLoader({ runRepo })
    const result = await loader.load({ runId: 1n })
    expect(result.loaded).toBe(1)
    expect(banks).toHaveLength(1)
    expect(runRepo.markSourceLoaded).toHaveBeenCalledWith(
      1n, 'banks', 'a'.repeat(24), { targetType: 'banks', targetPublicId: 'bank-1' }
    )
  })

  it('skips a bank that is already loaded by legacy id (idempotent)', async () => {
    records.push({
      source_legacy_id: 'a'.repeat(24),
      raw_document: { code: 'VCB', name: 'Vietcombank' },
      target_public_id: null
    })
    banks.push({ id: 9n, public_id: 'bank-9', legacy_mongo_id: 'a'.repeat(24) })
    const loader = new BanksLoader({ runRepo })
    const result = await loader.load({ runId: 1n })
    expect(banks).toHaveLength(1) // no duplicate
    expect(result.loaded).toBe(1)
  })

  it('rejects a staged bank with missing code or name', async () => {
    records.push({
      source_legacy_id: 'b'.repeat(24),
      raw_document: { code: '', name: 'No Code Bank' },
      target_public_id: null
    })
    const loader = new BanksLoader({ runRepo })
    const result = await loader.load({ runId: 1n })
    expect(result.rejected).toBe(1)
    expect(runRepo.markSourceRejected).toHaveBeenCalled()
    expect(banks).toHaveLength(0)
  })
})