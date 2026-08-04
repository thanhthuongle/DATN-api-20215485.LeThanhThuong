import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import TransactionContext from '~/v2/modules/financial/core/TransactionContext'

describe('TransactionContext', () => {
  const validParams = () => ({
    db: {},
    transactionPublicId: randomUUID(),
    actor: { actorType: 'USER', actorId: randomUUID() },
    financialSpaceId: BigInt(1),
    correlationId: randomUUID(),
    idempotencyKey: `test-${randomUUID()}`
  })

  it('creates a valid TransactionContext', () => {
    const params = validParams()
    const ctx = new TransactionContext(params)
    expect(ctx).toBeInstanceOf(TransactionContext)
    expect(ctx.db).toBe(params.db)
    expect(ctx.transactionPublicId).toBe(params.transactionPublicId)
    expect(ctx.actor).toEqual(params.actor)
    expect(ctx.financialSpaceId).toBe(params.financialSpaceId)
    expect(ctx.correlationId).toBe(params.correlationId)
    expect(ctx.idempotencyKey).toBe(params.idempotencyKey)
  })

  it('throws when db is missing', () => {
    const params = validParams()
    delete params.db
    expect(() => new TransactionContext(params)).toThrow(/TransactionClient/)
  })

  it('throws when transactionPublicId is missing', () => {
    const params = validParams()
    params.transactionPublicId = null
    expect(() => new TransactionContext(params)).toThrow(/transactionPublicId/)
  })

  it('throws when actor is missing', () => {
    const params = validParams()
    params.actor = null
    expect(() => new TransactionContext(params)).toThrow(/actor/)
  })

  it('throws when actorType is missing', () => {
    const params = validParams()
    params.actor = { actorId: 'abc' }
    expect(() => new TransactionContext(params)).toThrow(/actor/)
  })

  it('throws when actorId is missing', () => {
    const params = validParams()
    params.actor = { actorType: 'USER' }
    expect(() => new TransactionContext(params)).toThrow(/actor/)
  })

  it('throws when financialSpaceId is missing', () => {
    const params = validParams()
    params.financialSpaceId = null
    expect(() => new TransactionContext(params)).toThrow(/financialSpaceId/)
  })

  it('throws when correlationId is missing', () => {
    const params = validParams()
    params.correlationId = null
    expect(() => new TransactionContext(params)).toThrow(/correlationId/)
  })

  it('throws when idempotencyKey is missing', () => {
    const params = validParams()
    params.idempotencyKey = null
    expect(() => new TransactionContext(params)).toThrow(/idempotencyKey/)
  })

  describe('isTransactionContext', () => {
    it('returns true for TransactionContext instances', () => {
      const ctx = new TransactionContext(validParams())
      expect(TransactionContext.isTransactionContext(ctx)).toBe(true)
    })

    it('returns false for plain objects', () => {
      expect(TransactionContext.isTransactionContext({ db: {} })).toBe(false)
    })

    it('returns false for null/undefined', () => {
      expect(TransactionContext.isTransactionContext(null)).toBe(false)
      expect(TransactionContext.isTransactionContext(undefined)).toBe(false)
    })
  })

  describe('assertTransactionContext', () => {
    it('does not throw for valid TransactionContext', () => {
      const ctx = new TransactionContext(validParams())
      expect(() => TransactionContext.assertTransactionContext(ctx)).not.toThrow()
    })

    it('throws for non-TransactionContext with clear message', () => {
      expect(() => TransactionContext.assertTransactionContext({})).toThrow(
        /Global Prisma client is not allowed/
      )
    })
  })
})
