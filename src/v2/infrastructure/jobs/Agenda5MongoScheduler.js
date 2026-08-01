const Agenda = require('agenda')
import { MongoClient } from 'mongodb'
import { JobScheduler } from './JobScheduler'

export const AGENDA_STABLE_KEY_INDEX_NAME = 'v2_job_stable_key_unique'

export const ensureAgendaStoreIndexes = async (storeConfig) => {
  const client = new MongoClient(storeConfig.address)

  try {
    await client.connect()
    return await client
      .db(storeConfig.databaseName)
      .collection(storeConfig.collection)
      .createIndex({
        name: 1,
        'data.stableKey': 1
      }, {
        name: AGENDA_STABLE_KEY_INDEX_NAME,
        unique: true,
        partialFilterExpression: {
          'data.stableKey': { $type: 'string' }
        }
      })
  } finally {
    await client.close()
  }
}

const assertStableKey = (stableKey) => {
  if (!stableKey || typeof stableKey !== 'string') {
    throw new Error('A non-empty stableKey is required')
  }
}

export class Agenda5MongoScheduler extends JobScheduler {
  constructor({ agenda, registry, ensureStoreIndexes }) {
    super()
    this.agenda = agenda
    this.registry = registry
    this.ensureStoreIndexes = ensureStoreIndexes
    this.started = false
  }

  async saveUniqueJob(jobName, stableKey, job) {
    try {
      return await job.save()
    } catch (error) {
      if (error?.code !== 11000) throw error

      const [existingJob] = await this.agenda.jobs({
        name: jobName,
        'data.stableKey': stableKey
      }, {}, 1)

      if (!existingJob) throw error
      return existingJob
    }
  }

  define(jobName, handler) {
    const registryEntry = this.registry.get(jobName)
    this.agenda.define(jobName, {
      concurrency: registryEntry.concurrency,
      lockLifetime: registryEntry.lockLifetimeMs
    }, async (job) => handler({
      payload: job.attrs.data.payload,
      payloadVersion: job.attrs.data.payloadVersion,
      stableKey: job.attrs.data.stableKey,
      scheduledAt: job.attrs.nextRunAt
    }))
  }

  async scheduleOnce(jobName, runAt, payload, stableKey) {
    const registryEntry = this.registry.get(jobName)
    assertStableKey(stableKey)

    const scheduledAt = new Date(runAt)
    if (Number.isNaN(scheduledAt.getTime())) throw new Error('runAt must be a valid UTC instant')

    const job = this.agenda.create(jobName, {
      payload,
      payloadVersion: registryEntry.payloadVersion,
      stableKey
    })
      .unique({ name: jobName, 'data.stableKey': stableKey }, { insertOnly: true })
      .schedule(scheduledAt)

    return this.saveUniqueJob(jobName, stableKey, job)
  }

  async scheduleRecurring(jobName, schedule, payload, stableKey) {
    const registryEntry = this.registry.get(jobName)
    assertStableKey(stableKey)

    const job = this.agenda.create(jobName, {
      payload,
      payloadVersion: registryEntry.payloadVersion,
      stableKey
    })
      .unique({ name: jobName, 'data.stableKey': stableKey }, { insertOnly: true })
      .repeatEvery(schedule, { timezone: 'UTC', skipImmediate: true })

    return this.saveUniqueJob(jobName, stableKey, job)
  }

  cancel(stableKey) {
    assertStableKey(stableKey)
    return this.agenda.cancel({ 'data.stableKey': stableKey })
  }

  async start() {
    if (this.started) return
    await this.ensureStoreIndexes()
    await this.agenda.start()
    this.started = true
  }

  async stopGracefully() {
    if (!this.started) return
    await this.agenda.stop()
    this.started = false
  }
}

export const createAgenda5MongoScheduler = ({ storeConfig, registry, processEvery = '5 seconds' }) => {
  const agenda = new Agenda({
    db: {
      address: storeConfig.address,
      collection: storeConfig.collection
    },
    name: storeConfig.workerId,
    processEvery
  })

  return new Agenda5MongoScheduler({
    agenda,
    registry,
    ensureStoreIndexes: () => ensureAgendaStoreIndexes(storeConfig)
  })
}
