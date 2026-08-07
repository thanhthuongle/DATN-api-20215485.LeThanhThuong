import { beforeEach, describe, expect, it, vi } from 'vitest'

const cases = []
const mockDelegate = () => ({
  findUnique: vi.fn(async ({ where }) => cases.find((c) => c.fingerprint === where.fingerprint) || null),
  create: vi.fn(async ({ data }) => {
    const row = { id: BigInt(cases.length + 1), public_id: `d-${cases.length + 1}`, ...data }
    cases.push(row)
    return row
  }),
  update: vi.fn(async ({ where, data }) => {
    const idx = cases.findIndex((c) => c.public_id === where.public_id)
    if (idx < 0) throw new Error('not found')
    cases[idx] = { ...cases[idx], ...data }
    return cases[idx]
  }),
  count: vi.fn(({ where } = {}) => {
    let rows = cases
    if (where?.status) rows = rows.filter((c) => (Array.isArray(where.status.in)
      ? where.status.in.includes(c.status) : c.status === where.status))
    if (where?.severity) rows = rows.filter((c) => c.severity === where.severity)
    return Promise.resolve(rows.length)
  }),
  findMany: vi.fn(async () => cases.map((c) => ({ ...c })))
})

const mockedDb = { discrepancy_cases: mockDelegate() }

vi.mock('~/v2/infrastructure/database/prismaClient', () => ({
  getPrismaClient: () => mockedDb
}))

import { DiscrepancyManager } from '../../../src/v2/modules/migration/services/discrepancyManager.service'

describe('discrepancyManager.service', () => {
  let manager

  beforeEach(() => {
    cases.length = 0
    manager = new DiscrepancyManager()
  })

  it('computes a stable fingerprint from source/type/resource', () => {
    const a = manager.fingerprint({ source: 'MIGRATION', type: 'BALANCE_MISMATCH', resourceType: 'accounts', legacyMongoId: 'a'.repeat(24) })
    const b = manager.fingerprint({ source: 'MIGRATION', type: 'BALANCE_MISMATCH', resourceType: 'accounts', legacyMongoId: 'a'.repeat(24) })
    expect(a).toBe(b)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })

  it('creates a case with default status OPEN and severity INFO', async () => {
    const created = await manager.create({ source: 'MIGRATION', type: 'BALANCE_MISMATCH' })
    expect(created.status).toBe('OPEN')
    expect(created.severity).toBe('INFO')
    expect(created.fingerprint).toMatch(/^[a-f0-9]{64}$/)
  })

  it('deduplicates open cases with the same fingerprint', async () => {
    const params = { source: 'MIGRATION', type: 'X', detail: {} }
    const first = await manager.create(params)
    const second = await manager.create(params)
    expect(second.id).toBe(first.id)
    expect(cases).toHaveLength(1)
  })

  it('requires a resolution note to resolve a case', async () => {
    const created = await manager.create({ source: 'MIGRATION', type: 'X' })
    await expect(manager.resolve({ publicId: created.public_id, resolutionNote: 'ok', resolvedByUserId: 1n }))
      .resolves.toMatchObject({ status: 'RESOLVED' })
    await expect(manager.resolve({ publicId: created.public_id })).rejects.toThrow(/resolutionNote/)
  })

  it('rejects creation without a type', async () => {
    await expect(manager.create({ source: 'MIGRATION' })).rejects.toThrow(/type/)
  })

  it('summarizes open and blocking counts', async () => {
    await manager.create({ source: 'MIGRATION', type: 'A', severity: 'BLOCKING' })
    await manager.create({ source: 'MIGRATION', type: 'B' })
    await manager.create({ source: 'RECONCILIATION', type: 'C' })
    const summary = await manager.statusSummary()
    expect(summary.open).toBe(3)
    expect(summary.blocking).toBe(1)
  })
})