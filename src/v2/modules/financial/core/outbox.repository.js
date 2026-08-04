import TransactionContext from './TransactionContext'

/**
 * OutboxRepository — ghi outbox events trong cùng database transaction.
 *
 * Design contract: transaction-runtime.md §4
 * Decision: DEC-009
 *
 * Outbox events được ghi đồng bộ trong financial transaction;
 * worker xử lý sau commit.
 */

class OutboxRepository {
  /**
   * Tạo outbox event trong transaction.
   *
   * @param {TransactionContext} txContext
   * @param {object} params
   * @param {string} params.aggregateType - e.g. 'financial_transaction'
   * @param {string} params.aggregatePublicId - UUID của aggregate
   * @param {bigint} params.aggregateSequence
   * @param {string} params.eventType - e.g. 'TRANSACTION_POSTED'
   * @param {number} [params.eventSchemaVersion=1]
   * @param {object} params.payload - JSON payload
   * @returns {Promise<object>}
   */
  async create(txContext, {
    aggregateType,
    aggregatePublicId,
    aggregateSequence,
    eventType,
    eventSchemaVersion = 1,
    payload
  }) {
    TransactionContext.assertTransactionContext(txContext)

    return txContext.db.outbox_events.create({
      data: {
        financial_space_id: txContext.financialSpaceId,
        aggregate_type: aggregateType,
        aggregate_public_id: aggregatePublicId,
        aggregate_sequence: aggregateSequence,
        event_type: eventType,
        event_schema_version: eventSchemaVersion,
        status: 'PENDING',
        payload,
        attempt_count: 0
      }
    })
  }

  /**
   * Tạo nhiều outbox events (batch).
   * @param {TransactionContext} txContext
   * @param {object[]} events
   */
  async createBatch(txContext, events) {
    TransactionContext.assertTransactionContext(txContext)

    const created = []
    for (const event of events) {
      created.push(await this.create(txContext, event))
    }
    return created
  }

  /**
   * Claim pending outbox events cho worker (dùng FOR UPDATE SKIP LOCKED).
   * @param {TransactionContext} txContext
   * @param {object} params
   * @param {string} params.leaseOwner
   * @param {number} [params.batchSize=10]
   */
  async claimPending(txContext, { leaseOwner, batchSize = 10 }) {
    TransactionContext.assertTransactionContext(txContext)

    const now = new Date()
    const leaseExpiresAt = new Date(now.getTime() + 5 * 60 * 1000) // 5 min lease

    // Use raw query for FOR UPDATE SKIP LOCKED
    const events = await txContext.db.$queryRaw`
      SELECT id, public_id, aggregate_type, aggregate_public_id, event_type, payload
      FROM outbox_events
      WHERE status = 'PENDING'
        AND (next_attempt_at IS NULL OR next_attempt_at <= ${now})
      ORDER BY created_at ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    `

    if (events && events.length > 0) {
      const ids = events.map(e => e.id)
      await txContext.db.outbox_events.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'PROCESSING',
          lease_owner: leaseOwner,
          lease_expires_at: leaseExpiresAt,
          attempt_count: { increment: 1 },
          next_attempt_at: null
        }
      })
    }

    return events || []
  }
}

// Singleton instance
const outboxRepository = new OutboxRepository()

export default outboxRepository
export { OutboxRepository }
