import { randomUUID } from 'node:crypto'
import transactionManager from '../core/TransactionManager'
import snapshotGenerator from './snapshotGenerator'

/**
 * SnapshotSchedulerService — bridges the daily periodic-balance-snapshot job to
 * the snapshot core, idempotent per (space, business date).
 *
 * Design contract: periodic-balance-snapshots.md §8 (PBS-07), DEC-020.
 * - Business date is derived in UTC; scheduler runs ~every 15 min.
 * - Idempotency: an existing COMPLETED run for (space, date) is skipped so job
 *   retry / duplicate dispatch never creates a duplicate snapshot chain.
 * - Uses transactionManager.execute (JOB actor) so snapshot writes go through
 *   the explicit transaction boundary; never global Prisma on write path.
 */

const yesterdayUtc = () => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0, 0))
}

class SnapshotSchedulerService {
  /**
   * Generate (or skip) snapshots for one financial space on a business date.
   * @param {bigint} spaceId
   * @param {Date} businessDate - UTC midnight of the business day
   * @param {string} [triggerType]
   */
  async generateForSpace(spaceId, businessDate, triggerType = 'SCHEDULED') {
    return transactionManager.execute({
      actor: { actorType: 'JOB', actorId: 'v2.snapshot.daily' },
      financialSpaceId: spaceId,
      correlationId: randomUUID(),
      idempotencyKey: `snapshot-daily:${spaceId}:${businessDate.toISOString().split('T')[0]}:${triggerType}`,
      fn: async (txContext) => {
        // Idempotency: skip if a COMPLETED run already exists for this space/date.
        const existingRun = await txContext.db.balance_snapshot_runs.findFirst({
          where: {
            financial_space_id: spaceId,
            business_date: businessDate,
            status: 'COMPLETED'
          }
        })

        if (existingRun) {
          return { skipped: true, snapshotRun: existingRun }
        }

        const result = await snapshotGenerator.generateDailySnapshots(txContext, {
          businessDate,
          triggerType
        })

        return { skipped: false, ...result }
      }
    })
  }

  /**
   * Daily reconciliation handler: run for every active financial space on the
   * previous UTC business date (after grace period it may be current day).
   * Because the job registry owns scheduling/concurrency, this method purely
   * enumerates active spaces and calls generateForSpace.
   *
   * @param {import('../core/TransactionManager').TransactionManager} txManager
   * @returns {Promise<{spacesProcessed: number, results: Array}>}
   */
  async runDaily({ spacesQuery }) {
    const spaces = await spacesQuery.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true }
    })

    const businessDate = yesterdayUtc()
    const results = []

    for (const space of spaces) {
      try {
        const result = await this.generateForSpace(space.id, businessDate)
        results.push({ spaceId: space.id, ...result })
      } catch (error) {
        results.push({ spaceId: space.id, error: error.message })
      }
    }

    return { spacesProcessed: spaces.length, businessDate, results }
  }
}

const snapshotSchedulerService = new SnapshotSchedulerService()
export default snapshotSchedulerService
export { SnapshotSchedulerService }
