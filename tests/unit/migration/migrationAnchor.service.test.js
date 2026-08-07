import { beforeEach, describe, expect, it, vi } from 'vitest'

const anchors = []
const mockedDb = {
  migration_anchor_details: {
    create: vi.fn(async ({ data }) => {
      const row = { id: BigInt(anchors.length + 1), ...data }
      anchors.push(row)
      return row
    })
  }
}

vi.mock('~/v2/infrastructure/database/prismaClient', () => ({
  getPrismaClient: () => mockedDb
}))

import { MigrationAnchorService } from '../../../src/v2/modules/migration/services/migrationAnchor.service'

const baseParams = () => ({
  financialTransactionId: 1n,
  ledgerAccountId: 10n,
  migrationRunId: 2n,
  discrepancyCaseId: 3n,
  sourceLegacyBalance: 101n,
  reconstructedBalance: 100n,
  differenceAmount: 1n,
  sourceChecksum: 'a'.repeat(64),
  approvalActorUserId: 4n,
  approvalReason: 'approved legacy balance difference'
})

describe('migrationAnchor.service', () => {
  let service

  beforeEach(() => {
    anchors.length = 0
    service = new MigrationAnchorService()
  })

  it('creates an anchor when difference is valid and non-zero', async () => {
    const created = await service.createAnchor(baseParams())
    expect(anchors).toHaveLength(1)
    expect(created.difference_amount).toBe(1n)
    expect(created.approval_reason).toBe('approved legacy balance difference')
  })

  it('rejects a zero difference', async () => {
    await expect(service.createAnchor({ ...baseParams(), sourceLegacyBalance: 100n, reconstructedBalance: 100n, differenceAmount: 0n }))
      .rejects.toThrow(/non-zero difference/)
  })

  it('rejects an inconsistent difference amount', async () => {
    await expect(service.createAnchor({ ...baseParams(), differenceAmount: 5n }))
      .rejects.toThrow(/must equal source - reconstructed/)
  })

  it('rejects missing approver or reason', async () => {
    await expect(service.createAnchor({ ...baseParams(), approvalReason: '' }))
      .rejects.toThrow(/approver and reason/)
    await expect(service.createAnchor({ ...baseParams(), approvalActorUserId: null }))
      .rejects.toThrow(/approver and reason/)
  })
})