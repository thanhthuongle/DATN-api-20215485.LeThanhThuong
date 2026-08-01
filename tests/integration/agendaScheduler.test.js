import { MongoClient } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  AGENDA_STABLE_KEY_INDEX_NAME,
  Agenda5MongoScheduler,
  createAgenda5MongoScheduler
} from '~/v2/infrastructure/jobs/Agenda5MongoScheduler'
import { assertAgendaStoreIsolation } from '~/v2/infrastructure/jobs/agendaStoreConfig'
import { infrastructureJobRegistry } from '~/v2/infrastructure/jobs/jobRegistry'
import { startMongoContainer } from '../helpers/containers'

const JOB_NAME = 'v2.infrastructure.smoke'
const stableKey = 'v2.infrastructure.smoke:test'

let mongo
let rootClient
let restrictedClient
let scheduler
let agendaDatabase

const waitFor = async (predicate, timeoutMs = 15000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Timed out waiting for Agenda smoke job')
}

beforeAll(async () => {
  mongo = await startMongoContainer()
  const rootUri = new URL(mongo.getConnectionString())
  rootUri.searchParams.set('directConnection', 'true')
  rootClient = new MongoClient(rootUri.toString())
  await rootClient.connect()

  agendaDatabase = rootClient.db('agenda_v2_test')
  await agendaDatabase.command({
    createUser: 'agenda_worker',
    pwd: 'agenda_worker_test',
    roles: [{ role: 'readWrite', db: 'agenda_v2_test' }]
  })

  const restrictedUri = new URL(rootUri)
  restrictedUri.username = 'agenda_worker'
  restrictedUri.password = 'agenda_worker_test'
  restrictedUri.pathname = '/agenda_v2_test'
  restrictedUri.searchParams.set('authSource', 'agenda_v2_test')

  const storeConfig = assertAgendaStoreIsolation({
    agendaMongoUri: restrictedUri.toString(),
    agendaDatabaseName: 'agenda_v2_test',
    businessMongoUri: 'mongodb://business_app:secret@business.invalid/hey_money_v1',
    businessDatabaseName: 'hey_money_v1'
  })

  scheduler = createAgenda5MongoScheduler({
    storeConfig,
    registry: infrastructureJobRegistry,
    processEvery: '100 milliseconds'
  })
  restrictedClient = new MongoClient(restrictedUri.toString())
  await restrictedClient.connect()
})

afterAll(async () => {
  await scheduler?.stopGracefully()
  await restrictedClient?.close()
  await rootClient?.close()
  await mongo?.stop()
})

describe('Agenda5MongoScheduler adapter', () => {
  it('implements the JobScheduler contract methods', () => {
    for (const method of ['define', 'scheduleOnce', 'scheduleRecurring', 'cancel', 'start', 'stopGracefully']) {
      expect(Agenda5MongoScheduler.prototype[method]).toBeTypeOf('function')
    }
  })

  it('enforces one job for concurrent scheduling with a duplicate stable key', async () => {
    const handler = vi.fn()
    scheduler.define(JOB_NAME, handler)
    await scheduler.start()

    await Promise.all(Array.from({ length: 20 }, () => (
      scheduler.scheduleOnce(JOB_NAME, new Date(), { probe: true }, stableKey)
    )))
    await waitFor(() => handler.mock.calls.length === 1)

    const jobCollection = agendaDatabase.collection('v2_jobs')
    const storedJobs = await jobCollection.countDocuments({
      name: JOB_NAME,
      'data.stableKey': stableKey
    })
    const stableKeyIndex = (await jobCollection.indexes())
      .find(({ name }) => name === AGENDA_STABLE_KEY_INDEX_NAME)

    expect(storedJobs).toBe(1)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(stableKeyIndex).toMatchObject({
      key: { name: 1, 'data.stableKey': 1 },
      unique: true,
      partialFilterExpression: {
        'data.stableKey': { $type: 'string' }
      }
    })

    await scheduler.stopGracefully()
    await expect(scheduler.stopGracefully()).resolves.toBeUndefined()
  })

  it('uses a credential that cannot write V1 business collections', async () => {
    await expect(restrictedClient.db('hey_money_v1').collection('accounts').insertOne({ probe: true }))
      .rejects.toThrow(/not authorized|Unauthorized/i)
  })
})
