import { randomUUID } from 'node:crypto'
import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'
import TransactionContext from './TransactionContext'

/**
 * TransactionManager — entry point duy nhất mở Prisma database transaction
 * cho financial write. Tất cả service ghi tiền phải gọi transactionManager.execute().
 *
 * Design contract: transaction-runtime.md §1
 * Decision: DEC-007, DEC-009
 *
 * Không repository nào được mở transaction riêng.
 * Không provider/Redis/Socket/Agenda nào được gọi trong database transaction.
 */

class TransactionManager {
  constructor() {
    /** @type {import('@prisma/client').PrismaClient} */
    this._prisma = null
  }

  /**
   * Lazy-load Prisma client (singleton).
   * @returns {import('@prisma/client').PrismaClient}
   */
  _getPrisma() {
    if (!this._prisma) {
      this._prisma = getPrismaClient()
    }
    return this._prisma
  }

  /**
   * Mở một financial database transaction với TransactionContext.
   *
   * @param {object} params
   * @param {object} params.actor - { actorType: 'USER'|'JOB'|'ADMIN'|'MIGRATION', actorId: string }
   * @param {bigint} params.financialSpaceId
   * @param {string} params.correlationId
   * @param {string} params.idempotencyKey
   * @param {(txContext: TransactionContext) => Promise<any>} params.fn - Hàm business logic chạy trong transaction
   * @param {object} [params.options] - Prisma transaction options (isolationLevel, maxWait, timeout)
   * @returns {Promise<any>} Kết quả trả về từ fn
   */
  async execute({ actor, financialSpaceId, correlationId, idempotencyKey, fn, options }) {
    if (!actor?.actorType || !actor?.actorId) {
      throw new Error('TransactionManager.execute requires actor { actorType, actorId }')
    }
    if (!financialSpaceId) {
      throw new Error('TransactionManager.execute requires financialSpaceId')
    }
    if (!correlationId) {
      throw new Error('TransactionManager.execute requires correlationId')
    }
    if (!idempotencyKey) {
      throw new Error('TransactionManager.execute requires idempotencyKey')
    }
    if (typeof fn !== 'function') {
      throw new Error('TransactionManager.execute requires fn (callback)')
    }

    const prisma = this._getPrisma()
    const transactionPublicId = randomUUID()

    return prisma.$transaction(async (txDb) => {
      const txContext = new TransactionContext({
        db: txDb,
        transactionPublicId,
        actor,
        financialSpaceId,
        correlationId,
        idempotencyKey
      })

      return fn(txContext)
    }, options)
  }

  /**
   * Reset Prisma client (dùng cho test isolation).
   */
  async _reset() {
    this._prisma = null
  }
}

// Singleton instance
const transactionManager = new TransactionManager()

export default transactionManager
export { TransactionManager }
