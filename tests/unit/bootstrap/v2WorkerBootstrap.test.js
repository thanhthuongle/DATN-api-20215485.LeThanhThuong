import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { startV2Workers, stopV2Workers } from '~/v2/infrastructure/bootstrap/v2WorkerBootstrap'

const mockOutboxProcess = vi.hoisted(() => vi.fn().mockResolvedValue({ processed: 0, succeeded: 0, failed: 0 }))
const mockRunDaily = vi.hoisted(() => vi.fn().mockResolvedValue({ spacesProcessed: 0, results: [] }))
const mockScheduler = vi.hoisted(() => ({
  define: vi.fn(),
  scheduleRecurring: vi.fn().mockResolvedValue(undefined),
  start: vi.fn().mockResolvedValue(undefined),
  stopGracefully: vi.fn().mockResolvedValue(undefined)
}))
const mockEnv = vi.hoisted(() => ({
  AGENDA_MONGODB_URI: 'mongodb://agenda:secret@agenda.example/agenda_v2',
  AGENDA_DATABASE_NAME: 'agenda_v2',
  V2_OUTBOX_PROCESS_INTERVAL_MS: '100'
}))

vi.mock('~/config/environment', () => ({
  env: mockEnv
}))

vi.mock('~/v2/modules/financial/core/outboxConsumer.service', () => ({
  default: {
    process: mockOutboxProcess
  }
}))

vi.mock('~/v2/modules/financial/snapshot/snapshotScheduler.service', () => ({
  default: {
    runDaily: mockRunDaily
  }
}))

vi.mock('~/v2/infrastructure/jobs/Agenda5MongoScheduler', () => ({
  createAgenda5MongoScheduler: vi.fn(() => mockScheduler)
}))

describe('V2 worker bootstrap', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockOutboxProcess.mockClear()
    mockRunDaily.mockClear()
    mockScheduler.define.mockClear()
    mockScheduler.scheduleRecurring.mockClear()
    mockScheduler.start.mockClear()
    mockScheduler.stopGracefully.mockClear()
    vi.useFakeTimers({ shouldClearNativeTimers: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('startV2Workers registers the snapshot job and starts the Agenda scheduler', async () => {
    const bootstrap = await startV2Workers()

    const { createAgenda5MongoScheduler } = await import('~/v2/infrastructure/jobs/Agenda5MongoScheduler')
    expect(createAgenda5MongoScheduler).toHaveBeenCalledTimes(1)
    expect(createAgenda5MongoScheduler).toHaveBeenCalledWith({
      storeConfig: expect.objectContaining({
        address: 'mongodb://agenda:secret@agenda.example/agenda_v2',
        databaseName: 'agenda_v2',
        collection: 'v2_jobs'
      }),
      registry: expect.any(Object)
    })

    expect(mockScheduler.define).toHaveBeenCalledWith('v2.snapshot.daily', expect.any(Function))
    expect(mockScheduler.scheduleRecurring).toHaveBeenCalledWith(
      'v2.snapshot.daily',
      'every 15 minutes',
      {},
      'v2.snapshot.daily:recurring'
    )
    expect(mockScheduler.start).toHaveBeenCalledTimes(1)

    expect(bootstrap.scheduler).toBe(mockScheduler)
    expect(typeof bootstrap.stop).toBe('function')
    expect(typeof bootstrap.outboxInterval).toBe('object')
  })

  it('startV2Workers calls outboxConsumer.process via interval', async () => {
    const bootstrap = await startV2Workers()

    expect(mockOutboxProcess).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(100)
    expect(mockOutboxProcess).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(100)
    expect(mockOutboxProcess).toHaveBeenCalledTimes(2)

    await bootstrap.stop()
  })

  it('stopV2Workers clears the interval and stops the scheduler gracefully', async () => {
    const bootstrap = await startV2Workers()

    await vi.advanceTimersByTimeAsync(100)
    expect(mockOutboxProcess).toHaveBeenCalledTimes(1)

    await bootstrap.stop()

    await vi.advanceTimersByTimeAsync(1000)
    expect(mockOutboxProcess).toHaveBeenCalledTimes(1)
    expect(mockScheduler.stopGracefully).toHaveBeenCalledTimes(1)
  })

  it('stopV2Workers handles a null bootstrap gracefully', async () => {
    await expect(stopV2Workers(null)).resolves.toBeUndefined()
  })

  it('startV2Workers works when Agenda env vars are missing', async () => {
    const { env } = await import('~/config/environment')
    const originalAgendaUri = env.AGENDA_MONGODB_URI
    const originalAgendaDb = env.AGENDA_DATABASE_NAME

    env.AGENDA_MONGODB_URI = null
    env.AGENDA_DATABASE_NAME = null

    const bootstrap = await startV2Workers()

    expect(bootstrap.scheduler).toBeNull()
    expect(mockScheduler.start).not.toHaveBeenCalled()

    env.AGENDA_MONGODB_URI = originalAgendaUri
    env.AGENDA_DATABASE_NAME = originalAgendaDb
  })

  it('startV2Workers still arms outbox interval even if scheduler fails to start', async () => {
    const { env } = await import('~/config/environment')
    const originalAgendaUri = env.AGENDA_MONGODB_URI
    const originalAgendaDb = env.AGENDA_DATABASE_NAME

    env.AGENDA_MONGODB_URI = 'mongodb://agenda:secret@agenda.example/agenda_v2'
    env.AGENDA_DATABASE_NAME = 'agenda_v2'

    const schedulerStartError = new Error('scheduler boom')
    mockScheduler.start.mockRejectedValueOnce(schedulerStartError)

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const bootstrap = await startV2Workers()

    expect(bootstrap.scheduler).toBe(mockScheduler)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'V2 snapshot scheduler failed to start:',
      schedulerStartError
    )

    await vi.advanceTimersByTimeAsync(100)
    expect(mockOutboxProcess).toHaveBeenCalledTimes(1)

    consoleErrorSpy.mockRestore()

    env.AGENDA_MONGODB_URI = originalAgendaUri
    env.AGENDA_DATABASE_NAME = originalAgendaDb
  })
})
