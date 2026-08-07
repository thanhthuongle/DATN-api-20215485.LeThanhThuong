import { describe, expect, it } from 'vitest'
import sourceManifestService from '../../../src/v2/modules/migration/services/sourceManifest.service'
import { DECLARED_SOURCE_COLLECTIONS } from '../../../src/v2/modules/migration/constants'

const id = (suffix) => suffix.toString(16).padStart(24, '0')

describe('sourceManifest.service', () => {
  it('is deterministic: same data produces the same checksum', () => {
    const collections = [
      { collection: 'users', documents: [{ _id: id(1), email: 'a@example.com', balance: 100 }] },
      { collection: 'accounts', documents: [{ _id: id(7), balance: 100 }] }
    ]
    const a = sourceManifestService.build({ collections })
    const b = sourceManifestService.build({ collections })
    expect(a.sourceChecksum).toBe(b.sourceChecksum)
    expect(a.snapshotId).toBe(`sha256:${a.sourceChecksum}`)
  })

  it('rejects collections outside the declared source set', () => {
    expect(() => sourceManifestService.build({
      collections: [{ collection: 'not_a_source', documents: [] }]
    })).toThrow(/not a declared source/)
  })

  it('orders routes by dependency graph level canonically', () => {
    const collections = [
      { collection: 'accounts', documents: [] },
      { collection: 'users', documents: [] }
    ]
    const result = sourceManifestService.build({ collections })
    expect(result.collections[0].collection).toBe('users')
    expect(result.collections[1].collection).toBe('accounts')
  })

  it('requires documents to be an array', () => {
    expect(() => sourceManifestService.build({
      collections: [{ collection: 'users', documents: 'nope' }]
    })).toThrow(/must be an array/)
  })

  it('declared collection list has the expected 26 sources', () => {
    expect(DECLARED_SOURCE_COLLECTIONS).toHaveLength(26)
    expect(new Set(DECLARED_SOURCE_COLLECTIONS).size).toBe(26)
  })
})