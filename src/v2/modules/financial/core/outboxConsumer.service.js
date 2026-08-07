import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'

/**
 * OutboxConsumer — dispatches committed outbox events to registered side-effect
 * handlers (e.g. notification delivery) AFTER the financial transaction commits.
 *
 * Design contract: transaction-runtime.md §4, transaction-core.md §7, DEC-009.
 *
 * - Claims PENDING events with FOR UPDATE SKIP LOCKED (lease).
 * - Records inbox_receipts per consumer+event to deduplicate retries.
 * - Records outbox_delivery_attempts per attempt.
 * - On retry exhaustion marks DEAD_LETTER / REQUIRES_REVIEW; never retries
 *   blindly when delivery outcome is unknown.
 *
 * Touches ONLY operational tables (outbox/inbox/discrepancy), not
 * ledger/balance, so it may use the application client outside a financial
 * transaction. It never creates/posts financial entries.
 */

export class OutboxConsumer {
  constructor({ prismaProvider = getPrismaClient, maxAttempts = 5, leaseMs = 5 * 60 * 1000 } = {}) {
    this.prismaProvider = prismaProvider
    this.maxAttempts = maxAttempts
    this.leaseMs = leaseMs
    this.handlers = new Map()
    this.handlerNames = new Map()
  }

  register(eventType, { name, handle }) {
    if (!name || typeof handle !== 'function') {
      throw new Error('OutboxConsumer.register requires name and handle function')
    }
    this.handlers.set(eventType, handle)
    this.handlerNames.set(eventType, name)
    return this
  }

  async _claim(batchSize = 10, leaseOwner) {
    const prisma = this.prismaProvider()
    const now = new Date()
    const leaseExpiresAt = new Date(now.getTime() + this.leaseMs)

    const events = await prisma.$queryRaw`
      SELECT id, public_id, event_type, event_schema_version, aggregate_type,
             aggregate_public_id, payload, attempt_count
      FROM outbox_events
      WHERE status = 'PENDING'
        AND (next_attempt_at IS NULL OR next_attempt_at <= ${now})
      ORDER BY created_at ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    `

    if (events && events.length > 0) {
      const ids = events.map((e) => BigInt(e.id))
      await prisma.outbox_events.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'PROCESSING',
          lease_owner: leaseOwner,
          lease_expires_at: leaseExpiresAt,
          attempt_count: { increment: 1 }
        }
      })
    }

    return events || []
  }

  async _hasInboxReceipt(prisma, consumer, eventPublicId) {
    const found = await prisma.inbox_receipts.findUnique({
      where: { consumer_event_public_id: { consumer, event_public_id: eventPublicId } }
    })
    return Boolean(found)
  }

  _hash(payload) {
    const str = JSON.stringify(payload ?? {})
    let h1 = 0xdeadbeef ^ 0
    for (let i = 0; i < str.length; i++) {
      h1 = Math.imul(h1 ^ str.charCodeAt(i), 2654435761)
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
    h1 = Math.imul(h1 ^ (h1 >>> 13), 3266489909)
    return (h1 ^ (h1 >>> 16)).toString(16).padStart(64, '0').slice(0, 64)
  }

  async _markDelivered(prisma, event, consumer, result) {
    await prisma.outbox_events.update({
      where: { id: event.id },
      data: { status: 'DELIVERED', delivered_at: new Date() }
    })
    await prisma.inbox_receipts.upsert({
      where: { consumer_event_public_id: { consumer, event_public_id: event.public_id } },
      update: { result, processed_at: new Date() },
      create: {
        consumer,
        event_public_id: event.public_id,
        event_schema_version: event.event_schema_version,
        payload_hash: this._hash(event.payload),
        result
      }
    })
  }

  async _recordAttempt(prisma, event, { provider, attemptNumber, status, error }) {
    await prisma.outbox_delivery_attempts.create({
      data: {
        outbox_event_id: event.id,
        attempt_number: attemptNumber,
        provider,
        provider_idempotency_key: `${provider}:${event.public_id}:${attemptNumber}`,
        status,
        started_at: new Date(),
        finished_at: new Date(),
        error_code: error?.code || null,
        error_summary: error?.message ? String(error.message).slice(0, 400) : null
      }
    })
  }


  /**
   * Process up to batchSize pending outbox events.
   * @returns {Promise<{processed: number, succeeded: number, failed: number}>}
   */
  async process({ batchSize = 10, leaseOwner = 'v2-outbox-worker' } = {}) {
    const prisma = this.prismaProvider()
    const events = await this._claim(batchSize, leaseOwner)

    let succeeded = 0
    let failed = 0

    for (const event of events) {
      const handle = this.handlers.get(event.event_type)
      const consumer = this.handlerNames.get(event.event_type)

      if (!handle || !consumer) {
        await prisma.outbox_events.update({
          where: { id: event.id },
          data: {
            status: 'REQUIRES_REVIEW',
            last_error_code: 'NO_HANDLER',
            last_error_summary: `No outbox handler registered for ${event.event_type}`
          }
        })
        failed++
        continue
      }

      try {
        const already = await this._hasInboxReceipt(prisma, consumer, event.public_id)
        if (already) {
          await prisma.outbox_events.update({
            where: { id: event.id },
            data: { status: 'DELIVERED', delivered_at: new Date() }
          })
          succeeded++
          continue
        }

        await this._recordAttempt(prisma, event, {
          provider: consumer,
          attemptNumber: event.attempt_count,
          status: 'STARTED'
        })

        const result = await handle(event.payload, event)

        await this._markDelivered(prisma, event, consumer, result)
        succeeded++
      } catch (error) {
        failed++
        await this._recordAttempt(prisma, event, {
          provider: consumer,
          attemptNumber: event.attempt_count,
          status: 'FAILED',
          error
        })

        const exhausted = event.attempt_count >= this.maxAttempts
        await prisma.outbox_events.update({
          where: { id: event.id },
          data: exhausted
            ? {
              status: 'DEAD_LETTER',
              last_error_code: error.code || 'HANDLER_ERROR',
              last_error_summary: String(error.message || error).slice(0, 400),
              next_attempt_at: null
            }
            : {
              status: 'PENDING',
              last_error_code: error.code || 'HANDLER_ERROR',
              last_error_summary: String(error.message || error).slice(0, 400),
              next_attempt_at: new Date(Date.now() + 1000 * 60 * 2 ** Math.min(event.attempt_count, 5))
            }
        })
      }
    }

    return { processed: events.length, succeeded, failed }
  }
}

const outboxConsumer = new OutboxConsumer()
export default outboxConsumer


