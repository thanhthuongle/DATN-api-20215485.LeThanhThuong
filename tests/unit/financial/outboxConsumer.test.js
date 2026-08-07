import { describe, expect, it, vi, beforeEach } from 'vitest'
import { OutboxConsumer } from '~/v2/modules/financial/core/outboxConsumer.service'

const makePrisma = () => {
  const calls = { updates: [], attempts: [], receipts: [] }
  const prisma = {
    calls,
    $queryRaw: vi.fn().mockResolvedValue([]),
    outbox_events: {
      update: vi.fn(async ({ data }) => { calls.updates.push(data); return data }),
      updateMany: vi.fn()
    },
    inbox_receipts: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(async ({ create }) => { calls.receipts.push(create); return create })
    },
    outbox_delivery_attempts: {
      create: vi.fn(async ({ data }) => { calls.attempts.push(data); return data })
    }
  }
  return prisma
}

describe('OutboxConsumer', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('registers a handler and processes a delivered event idempotently', async () => {
    const prisma = makePrisma()
    const event = {
      id: BigInt(1),
      public_id: 'evt-1',
      event_type: 'NOTIFICATION_CREATED',
      event_schema_version: 1,
      aggregate_public_id: 'agg-1',
      payload: { title: 'hi' },
      attempt_count: 1
    }
    prisma.$queryRaw.mockResolvedValueOnce([event])

    const consumer = new OutboxConsumer({ prismaProvider: () => prisma, maxAttempts: 3 })
    const handle = vi.fn().mockResolvedValue({ ok: true })
    consumer.register('NOTIFICATION_CREATED', { name: 'notification', handle })

    const result = await consumer.process()

    expect(handle).toHaveBeenCalledWith({ title: 'hi' }, event)
    expect(prisma.calls.updates.some((u) => u.status === 'DELIVERED')).toBe(true)
    expect(prisma.calls.receipts.length).toBe(1)
    expect(prisma.calls.receipts[0].consumer).toBe('notification')
    expect(result).toMatchObject({ processed: 1, succeeded: 1, failed: 0 })
  })

  it('skips re-processing an already-delivered event via inbox receipt', async () => {
    const prisma = makePrisma()
    const event = { id: BigInt(1), public_id: 'evt-1', event_type: 'E', event_schema_version: 1, payload: {}, attempt_count: 1 }
    prisma.$queryRaw.mockResolvedValueOnce([event])
    prisma.inbox_receipts.findUnique.mockResolvedValueOnce({})

    const handle = vi.fn()
    const consumer = new OutboxConsumer({ prismaProvider: () => prisma })
    consumer.register('E', { name: 'consumer-e', handle })

    const result = await consumer.process()
    expect(handle).not.toHaveBeenCalled()
    expect(prisma.calls.receipts.length).toBe(0)
    expect(result.succeeded).toBe(1)
  })

  it('marks event REQUIRES_REVIEW when no handler is registered', async () => {
    const prisma = makePrisma()
    const event = { id: BigInt(1), public_id: 'evt-1', event_type: 'UNKNOWN', event_schema_version: 1, payload: {}, attempt_count: 1 }
    prisma.$queryRaw.mockResolvedValueOnce([event])

    const consumer = new OutboxConsumer({ prismaProvider: () => prisma })
    const result = await consumer.process()
    expect(prisma.calls.updates.some((u) => u.status === 'REQUIRES_REVIEW')).toBe(true)
    expect(result.failed).toBe(1)
  })

  it('retries until maxAttempts then moves to DEAD_LETTER', async () => {
    const prisma = makePrisma()
    const event = { id: BigInt(1), public_id: 'evt-1', event_type: 'E', event_schema_version: 1, payload: {}, attempt_count: 3 }
    prisma.$queryRaw.mockResolvedValueOnce([event])

    const consumer = new OutboxConsumer({ prismaProvider: () => prisma, maxAttempts: 3 })
    consumer.register('E', { name: 'c', handle: vi.fn().mockRejectedValue(new Error('boom')) })

    const result = await consumer.process()
    expect(result.failed).toBe(1)
    expect(prisma.calls.updates.some((u) => u.status === 'DEAD_LETTER')).toBe(true)
    expect(prisma.calls.attempts.filter((a) => a.status === 'FAILED').length).toBe(1)
  })

  it('requeues to PENDING with backoff when not exhausted', async () => {
    const prisma = makePrisma()
    const event = { id: BigInt(1), public_id: 'evt-1', event_type: 'E', event_schema_version: 1, payload: {}, attempt_count: 1 }
    prisma.$queryRaw.mockResolvedValueOnce([event])

    const consumer = new OutboxConsumer({ prismaProvider: () => prisma, maxAttempts: 5 })
    consumer.register('E', { name: 'c', handle: vi.fn().mockRejectedValue(new Error('boom')) })

    await consumer.process()
    const pendingUpdate = prisma.calls.updates.find((u) => u.status === 'PENDING')
    expect(pendingUpdate).toBeDefined()
    expect(pendingUpdate.next_attempt_at).toBeInstanceOf(Date)
  })

  it('requires name and handle to register', () => {
    const consumer = new OutboxConsumer({ prismaProvider: () => makePrisma() })
    expect(() => consumer.register('E', { name: '', handle: vi.fn() })).toThrow(/name/)
    expect(() => consumer.register('E', { name: 'x', handle: null })).toThrow(/handle/)
  })
})
