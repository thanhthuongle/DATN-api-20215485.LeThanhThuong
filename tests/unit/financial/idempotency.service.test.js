import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import TransactionContext from '~/v2/modules/financial/core/TransactionContext'
import { IdempotencyService, IdempotencyResult } from '~/v2/modules/financial/core/idempotency.service'
import idempotencyService from '~/v2/modules/financial/core/idempotency.service'
import idempotencyRepository from '~/v2/modules/financial/core/idempotency.repository'

const makeTxContext = (overrides = {}) => new TransactionContext({
  db: {},
  transactionPublicId: randomUUID(),
  actor: { actorType: 'USER', actorId: randomUUID() },
  financialSpaceId: BigInt(1),
  correlationId: randomUUID(),
  idempotencyKey: `key-${randomUUID()}`,
  ...overrides
})

describe('IdempotencyService', () => {
  describe('resolveIdempotency', () => {
    it('returns NEW when no existing record and claim succeeds', async () => {
      const txContext = makeTxContext()
      const operationKey = `op-${randomUUID()}`
      const hash = `hash-${randomUUID()}`

      vi.spyOn(idempotencyRepository, 'findByIdempotencyKey').mockResolvedValueOnce(null)
      vi.spyOn(idempotencyRepository, 'claimIdempotencySlot').mockResolvedValueOnce({
        id: BigInt(1),
        status: 'IN_PROGRESS',
        idempotency_key: operationKey,
        request_hash: hash
      })

      const result = await idempotencyService.resolveIdempotency(txContext, {
        operation: 'INCOME',
        idempotencyKey: operationKey,
        requestHash: hash
      })

      expect(result.result).toBe(IdempotencyResult.NEW)
      expect(result.record).toBeDefined()

      vi.restoreAllMocks()
    })

    it('returns OK when COMPLETED record with same hash', async () => {
      const txContext = makeTxContext()
      const operationKey = `op-${randomUUID()}`
      const hash = `hash-${randomUUID()}`

      vi.spyOn(idempotencyRepository, 'findByIdempotencyKey').mockResolvedValueOnce({
        id: BigInt(1),
        status: 'COMPLETED',
        idempotency_key: operationKey,
        request_hash: hash,
        response_status: 200,
        response_body: { ok: true },
        resource_type: 'financial_transaction',
        resource_public_id: randomUUID()
      })

      const result = await idempotencyService.resolveIdempotency(txContext, {
        operation: 'INCOME',
        idempotencyKey: operationKey,
        requestHash: hash
      })

      expect(result.result).toBe(IdempotencyResult.OK)
      expect(result.cachedResponse.status).toBe(200)

      vi.restoreAllMocks()
    })

    it('returns CONFLICT_DIFFERENT_HASH when COMPLETED with different hash', async () => {
      const txContext = makeTxContext()
      const operationKey = `op-${randomUUID()}`

      vi.spyOn(idempotencyRepository, 'findByIdempotencyKey').mockResolvedValueOnce({
        id: BigInt(1),
        status: 'COMPLETED',
        idempotency_key: operationKey,
        request_hash: 'old-hash',
        response_status: 200
      })

      const result = await idempotencyService.resolveIdempotency(txContext, {
        operation: 'INCOME',
        idempotencyKey: operationKey,
        requestHash: 'new-different-hash'
      })

      expect(result.result).toBe(IdempotencyResult.CONFLICT_DIFFERENT_HASH)

      vi.restoreAllMocks()
    })

    it('returns CONFLICT_SAME_KEY when IN_PROGRESS record exists', async () => {
      const txContext = makeTxContext()

      vi.spyOn(idempotencyRepository, 'findByIdempotencyKey').mockResolvedValueOnce({
        id: BigInt(1),
        status: 'IN_PROGRESS',
        idempotency_key: 'test-key',
        request_hash: 'test-hash'
      })

      const result = await idempotencyService.resolveIdempotency(txContext, {
        operation: 'INCOME',
        idempotencyKey: 'test-key',
        requestHash: 'test-hash'
      })

      expect(result.result).toBe(IdempotencyResult.CONFLICT_SAME_KEY)

      vi.restoreAllMocks()
    })

    it('returns CONFLICT_SAME_KEY when FAILED_FINAL record exists', async () => {
      const txContext = makeTxContext()

      vi.spyOn(idempotencyRepository, 'findByIdempotencyKey').mockResolvedValueOnce({
        id: BigInt(1),
        status: 'FAILED_FINAL',
        idempotency_key: 'test-key',
        request_hash: 'test-hash'
      })

      const result = await idempotencyService.resolveIdempotency(txContext, {
        operation: 'INCOME',
        idempotencyKey: 'test-key',
        requestHash: 'test-hash'
      })

      expect(result.result).toBe(IdempotencyResult.CONFLICT_SAME_KEY)

      vi.restoreAllMocks()
    })

    it('returns CONFLICT_SAME_KEY when claim fails (race condition)', async () => {
      const txContext = makeTxContext()

      vi.spyOn(idempotencyRepository, 'findByIdempotencyKey').mockResolvedValueOnce(null)
      vi.spyOn(idempotencyRepository, 'claimIdempotencySlot').mockResolvedValueOnce(null)

      const result = await idempotencyService.resolveIdempotency(txContext, {
        operation: 'INCOME',
        idempotencyKey: 'test-key',
        requestHash: 'test-hash'
      })

      expect(result.result).toBe(IdempotencyResult.CONFLICT_SAME_KEY)

      vi.restoreAllMocks()
    })
  })
})
