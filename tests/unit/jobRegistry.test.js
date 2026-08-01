import { describe, expect, it, vi } from 'vitest'
import { Agenda5MongoScheduler } from '~/v2/infrastructure/jobs/Agenda5MongoScheduler'
import {
  createJobRegistry,
  infrastructureJobRegistry
} from '~/v2/infrastructure/jobs/jobRegistry'

describe('V2 job registry', () => {
  it('contains the non-financial smoke job with required metadata', () => {
    expect(infrastructureJobRegistry.get('v2.infrastructure.smoke')).toMatchObject({
      ownerModule: 'platform',
      payloadVersion: 1,
      scheduleTimezone: 'UTC',
      sideEffects: 'none'
    })
  })

  it('rejects unregistered, duplicate and non-UTC jobs', () => {
    expect(() => infrastructureJobRegistry.get('missing')).toThrow(/Unregistered/)
    const smoke = infrastructureJobRegistry.get('v2.infrastructure.smoke')
    expect(() => createJobRegistry([smoke, smoke])).toThrow(/Duplicate/)
    expect(() => createJobRegistry([{ ...smoke, name: 'local-time-job', scheduleTimezone: 'Asia/Ho_Chi_Minh' }]))
      .toThrow(/UTC/)
  })

  it('uses the registry as the only source of Agenda concurrency and lock policy', () => {
    const agenda = { define: vi.fn() }
    const scheduler = new Agenda5MongoScheduler({
      agenda,
      registry: infrastructureJobRegistry,
      ensureStoreIndexes: vi.fn()
    })

    scheduler.define(
      'v2.infrastructure.smoke',
      vi.fn(),
      { concurrency: 99, lockLifetime: 1 }
    )

    expect(agenda.define).toHaveBeenCalledTimes(1)
    expect(agenda.define.mock.calls[0][1]).toEqual({
      concurrency: 1,
      lockLifetime: 30000
    })
  })

  it('returns the existing stable-key job after a duplicate-key race', async () => {
    const existingJob = { attrs: { name: 'v2.infrastructure.smoke' } }
    const agenda = {
      jobs: vi.fn().mockResolvedValue([existingJob])
    }
    const scheduler = new Agenda5MongoScheduler({
      agenda,
      registry: infrastructureJobRegistry,
      ensureStoreIndexes: vi.fn()
    })
    const duplicateKeyError = Object.assign(new Error('duplicate key'), { code: 11000 })
    const job = { save: vi.fn().mockRejectedValue(duplicateKeyError) }

    await expect(scheduler.saveUniqueJob(
      'v2.infrastructure.smoke',
      'v2.infrastructure.smoke:test',
      job
    )).resolves.toBe(existingJob)
    expect(agenda.jobs).toHaveBeenCalledWith({
      name: 'v2.infrastructure.smoke',
      'data.stableKey': 'v2.infrastructure.smoke:test'
    }, {}, 1)
  })
})
