import idempotencyRepository from './idempotency.repository'
import TransactionContext from './TransactionContext'

/**
 * IdempotencyService — orchestrates the full idempotency protocol.
 *
 * Protocol:
 * 1. Check if idempotency record exists
 * 2. If COMPLETED with same hash → return cached result (200 OK)
 * 3. If COMPLETED with different hash → 409 Conflict
 * 4. If IN_PROGRESS → 409 Conflict (concurrent request)
 * 5. If FAILED_FINAL → 409 Conflict (non-retryable)
 * 6. If not found → claim new slot (INSERT IN_PROGRESS)
 *    → caller executes business logic → completeIdempotencySlot or failIdempotencySlot
 *
 * Design contract: transaction-runtime.md §3
 * Decision: DEC-009
 */

/** @typedef {'OK'|'CONFLICT_SAME_KEY'|'CONFLICT_DIFFERENT_HASH'|'NEW'} IdempotencyResult */

const IdempotencyResult = {
  OK: 'OK',
  CONFLICT_SAME_KEY: 'CONFLICT_SAME_KEY',
  CONFLICT_DIFFERENT_HASH: 'CONFLICT_DIFFERENT_HASH',
  NEW: 'NEW'
}

class IdempotencyService {
  /**
   * Kiểm tra và claim idempotency slot cho operation.
   * Phải gọi trong database transaction (qua TransactionManager).
   *
   * @param {TransactionContext} txContext
   * @param {object} params
   * @param {string} params.operation - Tên operation (e.g. 'INCOME', 'EXPENSE')
   * @param {string} params.idempotencyKey
   * @param {string} params.requestHash - SHA-256 hash của canonical input
   * @returns {Promise<{ result: IdempotencyResult, record?: object, cachedResponse?: object }>}
   */
  async resolveIdempotency(txContext, { operation, idempotencyKey, requestHash }) {
    TransactionContext.assertTransactionContext(txContext)

    // Bước 1: Tìm record hiện có
    const existingRecord = await idempotencyRepository.findByIdempotencyKey(txContext, {
      idempotencyKey
    })

    if (existingRecord) {
      // Bước 2-5: Xử lý record đã tồn tại
      if (existingRecord.status === 'COMPLETED') {
        if (existingRecord.request_hash === requestHash) {
          // Same key + same hash → trả kết quả cached
          return {
            result: IdempotencyResult.OK,
            record: existingRecord,
            cachedResponse: {
              status: existingRecord.response_status,
              body: existingRecord.response_body,
              resourceType: existingRecord.resource_type,
              resourcePublicId: existingRecord.resource_public_id
            }
          }
        }
        // Same key + different hash → conflict
        return {
          result: IdempotencyResult.CONFLICT_DIFFERENT_HASH,
          record: existingRecord
        }
      }

      if (existingRecord.status === 'IN_PROGRESS') {
        // Concurrent request → conflict
        return {
          result: IdempotencyResult.CONFLICT_SAME_KEY,
          record: existingRecord
        }
      }

      if (existingRecord.status === 'FAILED_FINAL') {
        // Non-retryable failure
        return {
          result: IdempotencyResult.CONFLICT_SAME_KEY,
          record: existingRecord
        }
      }
    }

    // Bước 6: Claim slot mới
    const newRecord = await idempotencyRepository.claimIdempotencySlot(txContext, {
      idempotencyKey: idempotencyKey || txContext.idempotencyKey,
      operation,
      requestHash
    })

    if (!newRecord) {
      // Race condition: slot bị claim giữa lúc check và claim
      // Trả CONFLICT để caller retry
      return {
        result: IdempotencyResult.CONFLICT_SAME_KEY,
        record: null
      }
    }

    return {
      result: IdempotencyResult.NEW,
      record: newRecord
    }
  }

  /**
   * Complete idempotency slot sau khi business logic thành công.
   * @param {TransactionContext} txContext
   * @param {object} params
   * @param {bigint} params.idempotencyRecordId
   * @param {string} params.resourceType
   * @param {string} params.resourcePublicId
   * @param {object} [params.responseBody]
   */
  async completeSlot(txContext, params) {
    return idempotencyRepository.completeIdempotencySlot(txContext, params)
  }

  /**
   * Đánh dấu idempotency slot FAILED_FINAL.
   * @param {TransactionContext} txContext
   * @param {object} params
   * @param {bigint} params.idempotencyRecordId
   * @param {string} [params.errorCode]
   */
  async failSlot(txContext, params) {
    return idempotencyRepository.failIdempotencySlot(txContext, params)
  }
}

// Singleton instance
const idempotencyService = new IdempotencyService()

export default idempotencyService
export { IdempotencyService, IdempotencyResult }
