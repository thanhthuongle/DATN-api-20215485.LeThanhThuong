import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { ObjectId } from 'mongodb'

const require = createRequire(import.meta.url)
const { buildWave2IdentitySpacePlan } = require('../../scripts/lib/wave2-identity-space-plan.cjs')

const oid = (number) => new ObjectId(number.toString(16).padStart(24, '0'))
const createInput = (overrides = {}) => {
  const documents = {
    users: [{ _id: oid(1), email: 'private@example.invalid', password: '$2b$secret' }],
    families: [], banks: [{ _id: oid(2), name: 'Private bank' }],
    categories: [{ _id: oid(3), ownerType: 'individual', ownerId: oid(1), name: 'Private category' }],
    accounts: [{ _id: oid(4), ownerType: 'individual', ownerId: oid(1), accountName: 'Private account' }],
    accumulations: [{ _id: oid(5), ownerType: 'individual', ownerId: oid(1), accumulationName: 'Private goal' }],
    contacts: [{ _id: oid(6), ownerType: 'individual', ownerId: oid(1), name: 'Private contact' }],
    ...overrides
  }
  return {
    sanitizedSnapshot: { evidenceManifest: { sourceSnapshotId: 'sha256:source', evidenceFingerprint: 'evidence' } },
    transformPlan: {
      summary: { blockingCount: 0, unclassifiedCount: 0 },
      canonicalPlan: { planHash: 'transform-plan' },
      getOperationalTargetPlan: () => ({ getLoadedDocuments: (collection) => documents[collection] || [] })
    }
  }
}

describe('Wave 2 identity and personal-space plan', () => {
  it('resolves each individual owner without exposing operational values and is deterministic', () => {
    const first = buildWave2IdentitySpacePlan(createInput())
    const second = buildWave2IdentitySpacePlan(createInput())

    expect(first.counts).toEqual({ users: 1, personalSpaces: 1, ownerMemberships: 1, banks: 1, categories: 1, accounts: 1, accumulations: 1, contacts: 1 })
    expect(first.spaces[0]).toMatchObject({ kind: 'PERSONAL', ownerUserKey: `user:${oid(1)}`, targetKey: `personal-space:${oid(1)}` })
    expect(first.memberships[0]).toMatchObject({ role: 'OWNER', status: 'ACTIVE', spaceKey: `personal-space:${oid(1)}` })
    expect(first.planHash).toBe(second.planHash)
    expect(JSON.stringify(first)).not.toMatch(/private|example|\$2b\$/i)
    expect(() => { first.users[0].legacyId = 'changed' }).toThrow()
  })

  it.each([
    ['unknown owner type', { categories: [{ _id: oid(3), ownerType: 'company', ownerId: oid(1) }] }],
    ['missing owner', { accounts: [{ _id: oid(4), ownerType: 'individual', ownerId: oid(99) }] }],
    ['family rows outside this slice', { families: [{ _id: oid(8) }] }]
  ])('fails closed on %s', (_scenario, overrides) => {
    expect(() => buildWave2IdentitySpacePlan(createInput(overrides))).toThrow(/BLOCKING_OWNER_RESOLUTION/)
  })
})
