import TransactionContext from './TransactionContext'

/**
 * IdempotencyRepository — quản lý idempotency records trong database.
 * Tất cả write operation phải qua TransactionContext.
 *
 * Design contract: transaction-runtime.md §3
 * Decision: DEC-009
 */

class IdempotencyRepository {
  /**
   * Tìm idempotency record đang active theo composite key.
   * @param {TransactionContext} txContext
   * @param {object} params
   * @param {string} params.idempotencyKey
   * @returns {Promise<object|null>}
   */
  async findByIdempotencyKey(txContext, { idempotencyKey }) {
    TransactionContext.assertTransactionContext(txContext)

    return txContext.db.idempotency_records.findFirst({
      where: {
        financial_space_id: txContext.financialSpaceId,
        actor_type: txContext.actor.actorType,
        actor_id: txContext.actor.actorId,
        idempotency_key: idempotencyKey
      }
    })
  }

  /**
   * Claim idempotency slot (INSERT với status IN_PROGRESS).
   * Thất bại nếu composite key đã tồn tại (unique constraint).
   * @param {TransactionContext} txContext
   * @param {object} params
   * @param {string} params.idempotencyKey
   * @param {string} params.operation
   * @param {string} params.requestHash
   * @param {number} [params.leaseTimeoutMs=30000]
   * @returns {Promise<object>}
   */
  async claimIdempotencySlot(txContext, { idempotencyKey, operation, requestHash, leaseTimeoutMs = 30000 }) {
    TransactionContext.assertTransactionContext(txContext)

    const now = new Date()
    const leaseExpiresAt = new Date(now.getTime() + leaseTimeoutMs)

    try {
      const record = await txContext.db.idempotency_records.create({
        data: {
          financial_space_id: txContext.financialSpaceId,
          actor_type: txContext.actor.actorType,
          actor_id: txContext.actor.actorId,
          operation,
          idempotency_key: idempotencyKey,
          request_hash: requestHash,
          status: 'IN_PROGRESS',
          lease_owner: txContext.transactionPublicId,
          lease_expires_at: leaseExpiresAt
        }
      })
      return record
    } catch (err) {
      // Nếu unique constraint vi phạm, tức là slot đã bị claim
      if (err.code === 'P2002') {
        return null
      }
      throw err
    }
  }

  /**
   * Complete idempotency slot (UPDATE status COMPLETED và gắn resource reference).
   * @param {TransactionContext} txContext
   * @param {object} params
   * @param {bigint} params.idempotencyRecordId
   * @param {string} params.resourceType
   * @param {string} params.resourcePublicId
   * @param {object} [params.responseBody]
   * @param {number} [params.responseStatus=200]
   */
  async completeIdempotencySlot(txContext, {
    idempotencyRecordId,
    resourceType,
    resourcePublicId,
    responseBody = {},
    responseStatus = 200
  }) {
    TransactionContext.assertTransactionContext(txContext)

    const renewalExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 ngày

    return txContext.db.idempotency_records.update({
      where: { id: idempotencyRecordId },
      data: {
        status: 'COMPLETED',
        resource_type: resourceType,
        resource_public_id: resourcePublicId,
        response_body: responseBody,
        response_status: responseStatus,
        completed_at: new Date(),
        lease_owner: null,
        lease_expires_at: renewalExpiresAt
      }
    })
  }

  /**
   * Đánh dấu idempotency slot FAILED_FINAL.
   * @param {TransactionContext} txContext
   * @param {object} params
   * @param {bigint} params.idempotencyRecordId
   * @param {string} [params.errorCode]
   */
  async failIdempotencySlot(txContext, { idempotencyRecordId, errorCode }) {
    TransactionContext.assertTransactionContext(txContext)

    return txContext.db.idempotency_records.update({
      where: { id: idempotencyRecordId },
      data: {
        status: 'FAILED_FINAL',
        error_code: errorCode || null,
        completed_at: new Date(),
        lease_owner: null,
        lease_expires_at: null
      }
    })
  }
}

// Singleton instance
const idempotencyRepository = new IdempotencyRepository()

export default idempotencyRepository
export { IdempotencyRepository }
