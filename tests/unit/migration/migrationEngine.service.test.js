import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockedPrisma = {
  $transaction: async (fn) => {
    const txProxy = new Proxy({}, { get: () => txProxy, set: () => true })
    return fn(txProxy)
  }
}

vi.mock('~/v2/infrastructure/database/prismaClient', () => ({
  getPrismaClient: () => mockedPrisma
}))

import { MigrationEngine } from '../../../src/v2/modules/migration/services/migrationEngine.service'
import { MIGRATION_MAPPING_VERSION, SCHEMA_VERSION } from '../../../src/v2/modules/migration/constants'

const id = (suffix) => suffix.toString(16).padStart(24, '0')

describe('migrationEngine.service', () => {
  let engine
  let runRepo
  let discrepancy
  let reconciliation

  beforeEach(() => {
    runRepo = {
      createRun: vi.fn().mockResolvedValue({ id: 1n, public_id: 'run-1' }),
      findRun: vi.fn().mockResolvedValue(null),
      updateRun: vi.fn().mockResolvedValue({}),
      createCheckpoint: vi.fn().mockResolvedValue({}),
      findSourceRecord: vi.fn().mockResolvedValue(null),
      stageSourceRecord: vi.fn().mockResolvedValue({}),
      markSourceArchived: vi.fn().mockResolvedValue({}),
      markSourceLoaded: vi.fn().mockResolvedValue({}),
      markSourceRejected: vi.fn().mockResolvedValue({})
    }
    discrepancy = { create: vi.fn().mockResolvedValue({}) }
    reconciliation = { run: vi.fn().mockResolvedValue({ pass: true, gates: [] }) }
    engine = new MigrationEngine({ runRepo, discrepancy, reconciliation })
  })

  it('redacts secret fields and records their paths', () => {
    const doc = { _id: id(1), email: 'x@example.com', password: 'hashed', verifyToken: 'tok', balance: 100 }
    const rawHash = 'a'.repeat(64)
    const result = engine.sanitizeDocument(doc, rawHash)
    expect(result.sanitized.password).toBeUndefined()
    expect(result.sanitized.verifyToken).toBeUndefined()
    expect(result.sanitized.email).toBe('x@example.com')
    expect(result.redactionManifest).toEqual(expect.arrayContaining(['$.password', '$.verifyToken']))
    expect(result.sourceHash).toBe(rawHash)
    expect(result.sanitizedHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('stages records, archives archive-only collections, and rejects invalid ids', async () => {
    const collections = [
      { collection: 'money_sources', documents: [{ _id: id(6), ownerId: id(1), accountIds: [] }] },
      { collection: 'accounts', documents: [{ _id: id(7), balance: 100 }] },
      { collection: 'system_tasks', documents: [{ _id: 'not-a-valid-24-char-id!!!' }] }
    ]
    const stats = await engine.stageAll({ runId: 1n, collections })
    expect(stats.archived).toBe(1) // money_sources is archive-only
    expect(stats.rejected).toBe(1) // system_tasks invalid _id
    expect(stats.loaded).toBe(1) // accounts loaded
    expect(runRepo.createCheckpoint).toHaveBeenCalledTimes(3)
  })

  it('stages idempotently: existing records are not duplicated', async () => {
    runRepo.findSourceRecord.mockResolvedValue({ id: 99n })
    const collections = [{ collection: 'users', documents: [{ _id: id(1) }] }]
    const stats = await engine.stageAll({ runId: 1n, collections })
    expect(runRepo.stageSourceRecord).not.toHaveBeenCalled()
    expect(stats.loaded).toBe(1)
  })

  it('runs a migration end-to-end and marks COMPLETED when reconciliation passes', async () => {
    reconciliation.run.mockResolvedValue({
      pass: true,
      gates: [{ name: 'balanced_postings', pass: true }]
    })
    const collections = [{ collection: 'users', documents: [{ _id: id(1) }] }]
    const result = await engine.runMigration({ collections, runType: 'DRY_RUN' })
    expect(result.run.id).toBe(1n)
    expect(runRepo.updateRun).toHaveBeenCalledWith(
      1n,
      expect.objectContaining({ status: 'COMPLETED' })
    )
    expect(discrepancy.create).not.toHaveBeenCalled()
    expect(result.manifest.sourceChecksum).toMatch(/^[a-f0-9]{64}$/)
  })

  it('marks BLOCKED and creates a discrepancy when reconciliation fails', async () => {
    reconciliation.run.mockResolvedValue({
      pass: false,
      gates: [{ name: 'balanced_postings', pass: false }]
    })
    const collections = [{ collection: 'users', documents: [{ _id: id(1) }] }]
    await engine.runMigration({ collections, runType: 'DRY_RUN' })
    expect(runRepo.updateRun).toHaveBeenCalledWith(
      1n,
      expect.objectContaining({ status: 'BLOCKED' })
    )
    expect(discrepancy.create).toHaveBeenCalled()
  })

  it('rejects a duplicate run with the same identity', async () => {
    runRepo.findRun.mockResolvedValue({ id: 5n })
    const collections = [{ collection: 'users', documents: [{ _id: id(1) }] }]
    await expect(engine.runMigration({ collections, runType: 'DRY_RUN' }))
      .rejects.toThrow(/ALREADY_EXISTS/)
  })

  it('marks FAILED and rethrows on transform error', async () => {
    const transform = vi.fn().mockRejectedValue(new Error('load blew up'))
    const collections = [{ collection: 'users', documents: [{ _id: id(1) }] }]
    await expect(engine.runMigration({ collections, transform, runType: 'REHEARSAL' }))
      .rejects.toThrow('load blew up')
    expect(runRepo.updateRun).toHaveBeenCalledWith(
      1n,
      expect.objectContaining({ status: 'FAILED' })
    )
  })

  it('exposes constants used in run identity', () => {
    expect(MIGRATION_MAPPING_VERSION).toMatch(/wave6/)
    expect(SCHEMA_VERSION).toMatch(/^20/)
  })
})