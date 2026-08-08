import outboxConsumer from '~/v2/modules/financial/core/outboxConsumer.service'
import snapshotSchedulerService from '~/v2/modules/financial/snapshot/snapshotScheduler.service'
import { createAgenda5MongoScheduler } from '~/v2/infrastructure/jobs/Agenda5MongoScheduler'
import { businessJobRegistry } from '~/v2/infrastructure/jobs/jobRegistry'
import { env } from '~/config/environment'

/**
 * V2WorkerBootstrap � starts and stops V2 background workers.
 *
 * Workers:
 * 1. Outbox consumer loop: periodically dispatches committed outbox events to
 *    registered side-effect handlers (e.g., notification delivery).
 * 2. Snapshot scheduler: Agenda-backed recurring job that triggers daily
 *    balance-snapshot generation for active financial spaces.
 *
 * Design contract: background-jobs.md �runtime/bootstrap; DEC-020.
 */

const DEFAULT_OUTBOX_INTERVAL_MS = 30_000

const getOutboxIntervalMs = () => {
  const raw = env.V2_OUTBOX_PROCESS_INTERVAL_MS ?? process.env.V2_OUTBOX_PROCESS_INTERVAL_MS
  if (raw === undefined || raw === null || raw === '') return DEFAULT_OUTBOX_INTERVAL_MS
  const parsed = Number.parseInt(raw, 10)
  if (Number.isFinite(parsed) && parsed > 0) return parsed
  return DEFAULT_OUTBOX_INTERVAL_MS
}

const getAgendaStoreConfig = () => {
  const raw = env.AGENDA_MONGODB_URI
  const databaseName = env.AGENDA_DATABASE_NAME
  if (!raw || !databaseName) return null

  const [mainPart, query] = raw.split('?')
  const base = mainPart.endsWith('/')
    ? mainPart.slice(0, -1)
    : mainPart

  const address = query
    ? `${base}/${databaseName}?${query}`
    : `${base}/${databaseName}`

  return {
    address,
    databaseName,
    collection: 'v2_jobs',
    workerId: 'v2-worker'
  }
}

export const startV2Workers = async () => {
  const outboxIntervalMs = getOutboxIntervalMs()

  // --- Outbox consumer loop ---
  const runOutboxLoop = async () => {
    try {
      await outboxConsumer.process({ batchSize: 10, leaseOwner: 'v2-outbox-worker' })
    } catch (error) {
      console.error('[V2WorkerBootstrap] Outbox consumer loop error:', error)
    }
  }

  const outboxInterval = setInterval(runOutboxLoop, outboxIntervalMs)

  if (typeof outboxInterval.unref === 'function') {
    outboxInterval.unref()
  }

  // --- Snapshot scheduler (Agenda-backed) ---
  const storeConfig = getAgendaStoreConfig()
  let scheduler = null

  if (storeConfig) {
    scheduler = createAgenda5MongoScheduler({
      storeConfig,
      registry: businessJobRegistry
    })

    scheduler.define('v2.snapshot.daily', async () => {
      try {
        await snapshotSchedulerService.runDaily({ spacesQuery: { findMany: () => [] } })
      } catch (error) {
        console.error('[V2WorkerBootstrap] Snapshot job failed:', error)
        throw error
      }
    })

    await scheduler.start().catch((error) => {
      console.error('V2 snapshot scheduler failed to start:', error)
    })

    const stableKey = 'v2.snapshot.daily:recurring'
    scheduler.scheduleRecurring('v2.snapshot.daily', 'every 15 minutes', {}, stableKey).catch((error) => {
      console.error('[V2WorkerBootstrap] Failed to schedule snapshot job:', error)
    })
  }

  return {
    outboxInterval,
    scheduler,
    async stop() {
      clearInterval(outboxInterval)
      if (scheduler) {
        try {
          await scheduler.stopGracefully()
        } catch (error) {
          console.error('[V2WorkerBootstrap] Error stopping snapshot scheduler:', error)
        }
      }
    }
  }
}

export const stopV2Workers = async (bootstrap) => {
  if (!bootstrap) return
  await bootstrap.stop()
}
