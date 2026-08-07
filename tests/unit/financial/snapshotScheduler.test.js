import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SnapshotSchedulerService } from '~/v2/modules/financial/snapshot/snapshotScheduler.service'
import transactionManager from '~/v2/modules/financial/core/TransactionManager'
import snapshotGenerator from '~/v2/modules/financial/snapshot/snapshotGenerator'

describe('SnapshotSchedulerService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('generateForSpace', () => {
    it('skips generation when a COMPLETED run already exists (idempotency)', async () => {
      const existingRun = { id: BigInt(1), status: 'COMPLETED' }
      vi.spyOn(transactionManager, 'execute').mockImplementationOnce(async ({ fn }) => {
        const txContext = {
          db: {
            balance_snapshot_runs: {
              findFirst: vi.fn().mockResolvedValueOnce(existingRun)
            }
          },
          financialSpaceId: BigInt(1)
        }
        return fn(txContext)
      })
      const genSpy = vi.spyOn(snapshotGenerator, 'generateDailySnapshots')

      const service = new SnapshotSchedulerService()
      const result = await service.generateForSpace(
        BigInt(1),
        new Date('2026-08-05T00:00:00Z')
      )

      expect(result.skipped).toBe(true)
      expect(result.snapshotRun).toEqual(existingRun)
      expect(genSpy).not.toHaveBeenCalled()
    })

    it('generates snapshots when no COMPLETED run exists', async () => {
      vi.spyOn(transactionManager, 'execute').mockImplementationOnce(async ({ fn }) => {
        const txContext = {
          db: {
            balance_snapshot_runs: {
              findFirst: vi.fn().mockResolvedValueOnce(null)
            }
          },
          financialSpaceId: BigInt(1)
        }
        return fn(txContext)
      })
      const genSpy = vi.spyOn(snapshotGenerator, 'generateDailySnapshots')
        .mockResolvedValueOnce({ snapshotRun: { id: BigInt(2) }, errors: 0 })

      const service = new SnapshotSchedulerService()
      const result = await service.generateForSpace(
        BigInt(1),
        new Date('2026-08-05T00:00:00Z')
      )

      expect(result.skipped).toBe(false)
      expect(genSpy).toHaveBeenCalledWith(
        expect.objectContaining({ financialSpaceId: BigInt(1) }),
        expect.objectContaining({ triggerType: 'SCHEDULED' })
      )
    })
  })

  describe('runDaily', () => {
    it('iterates active spaces and reports per-space results', async () => {
      const spacesQuery = {
        findMany: vi.fn().mockResolvedValueOnce([{ id: BigInt(1) }, { id: BigInt(2) }])
      }
      vi.spyOn(transactionManager, 'execute').mockImplementation(async ({ fn }) => {
        const txContext = {
          db: { balance_snapshot_runs: { findFirst: vi.fn().mockResolvedValueOnce(null) } },
          financialSpaceId: BigInt(1)
        }
        return fn(txContext)
      })
      vi.spyOn(snapshotGenerator, 'generateDailySnapshots').mockResolvedValue({
        snapshotRun: { id: BigInt(9) },
        accountsProcessed: 3,
        errorCount: 0
      })

      const service = new SnapshotSchedulerService()
      const result = await service.runDaily({ spacesQuery })

      expect(result.spacesProcessed).toBe(2)
      expect(result.results).toHaveLength(2)
      expect(result.results[0]).toMatchObject({ skipped: false })
    })

    it('captures errors per space without failing the whole run', async () => {
      const spacesQuery = {
        findMany: vi.fn().mockResolvedValueOnce([{ id: BigInt(1) }, { id: BigInt(2) }])
      }
      vi.spyOn(transactionManager, 'execute')
        .mockRejectedValueOnce(new Error('db down'))
        .mockImplementationOnce(async ({ fn }) => {
          const txContext = {
            db: { balance_snapshot_runs: { findFirst: vi.fn().mockResolvedValueOnce(null) } },
            financialSpaceId: BigInt(2)
          }
          return fn(txContext)
        })
      vi.spyOn(snapshotGenerator, 'generateDailySnapshots').mockResolvedValue({
        snapshotRun: { id: BigInt(9) },
        accountsProcessed: 1,
        errorCount: 0
      })

      const service = new SnapshotSchedulerService()
      const result = await service.runDaily({ spacesQuery })

      expect(result.results[0].error).toBe('db down')
      expect(result.results[1].skipped).toBe(false)
    })
  })
})
