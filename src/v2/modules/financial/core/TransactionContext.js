/**
 * TransactionContext — explicit database boundary cho financial write paths.
 *
 * Mọi financial repository/repository write bắt buộc nhận TransactionContext thay vì
 * dùng global Prisma client. TransactionContext chỉ được tạo bởi TransactionManager.
 *
 * Design contract: transaction-runtime.md §1, transaction-core.md §2
 * Decision: DEC-007, DEC-009
 */

class TransactionContext {
  /**
   * @param {object} params
   * @param {import('@prisma/client').Prisma.TransactionClient} params.db
   * @param {string} params.transactionPublicId - UUID của financial transaction
   * @param {object} params.actor - { actorType, actorId }
   * @param {bigint} params.financialSpaceId - internal ID của financial space
   * @param {string} params.correlationId - correlation ID xuyên suốt request
   * @param {string} params.idempotencyKey - idempotency key của operation
   */
  constructor({ db, transactionPublicId, actor, financialSpaceId, correlationId, idempotencyKey }) {
    if (!db) throw new Error('TransactionContext requires a Prisma TransactionClient (db)')
    if (!transactionPublicId) throw new Error('TransactionContext requires transactionPublicId')
    if (!actor?.actorType || !actor?.actorId) throw new Error('TransactionContext requires actor { actorType, actorId }')
    if (!financialSpaceId) throw new Error('TransactionContext requires financialSpaceId')
    if (!correlationId) throw new Error('TransactionContext requires correlationId')
    if (!idempotencyKey) throw new Error('TransactionContext requires idempotencyKey')

    /** @type {import('@prisma/client').Prisma.TransactionClient} */
    this.db = db
    /** @type {string} */
    this.transactionPublicId = transactionPublicId
    /** @type {{ actorType: string, actorId: string }} */
    this.actor = actor
    /** @type {bigint} */
    this.financialSpaceId = financialSpaceId
    /** @type {string} */
    this.correlationId = correlationId
    /** @type {string} */
    this.idempotencyKey = idempotencyKey
  }

  /**
   * Verify that txContext is a valid TransactionContext.
   * Dùng làm guard trong financial repositories để phát hiện
   * nhầm lẫn global client.
   * @param {any} ctx
   * @returns {ctx is TransactionContext}
   */
  static isTransactionContext(ctx) {
    return ctx instanceof TransactionContext
  }

  /**
   * Assert that ctx is a valid TransactionContext, throw nếu không.
   * @param {any} ctx
   */
  static assertTransactionContext(ctx) {
    if (!TransactionContext.isTransactionContext(ctx)) {
      throw new Error(
        'Financial write repository requires TransactionContext. ' +
        'Global Prisma client is not allowed in financial write paths.'
      )
    }
  }
}

export default TransactionContext
