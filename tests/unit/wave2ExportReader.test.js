import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BSON, ObjectId } from 'mongodb'
import reader from '../../scripts/lib/wave2-export-reader.cjs'
import manifestModule from '../../scripts/lib/wave2-export-manifest.cjs'

const {
  DECLARED_COLLECTIONS,
  OBSERVED_ABSENT_COLLECTIONS,
  OBSERVED_PRESENT_COLLECTIONS,
  inspectExportDirectory,
  parseBsonSequence
} = reader
const { createExportManifest } = manifestModule

const tempDirectories = []

const makeTempDirectory = () => {
  const directory = mkdtempSync(join(tmpdir(), 'wave2-export-test-'))
  tempDirectories.push(directory)
  return directory
}

const metadataFor = (collection, ordinal) => JSON.stringify({
  indexes: [{ v: { $numberInt: '2' }, key: { _id: { $numberInt: '1' } }, name: '_id_' }],
  uuid: ordinal.toString(16).padStart(32, '0'),
  collectionName: collection,
  type: 'collection'
})

const createFixture = ({ mutateMetadata, documentFor } = {}) => {
  const directory = makeTempDirectory()
  OBSERVED_PRESENT_COLLECTIONS.forEach((collection, index) => {
    const document = documentFor?.(collection, index) || {
      _id: new ObjectId((index + 1).toString(16).padStart(24, '0')),
      fixtureCode: `SAFE_${index}`
    }
    writeFileSync(join(directory, `${collection}.bson`), BSON.serialize(document))
    const metadata = JSON.parse(metadataFor(collection, index + 1))
    mutateMetadata?.(metadata, collection, index)
    writeFileSync(join(directory, `${collection}.metadata.json`), JSON.stringify(metadata))
  })
  writeFileSync(join(directory, 'prelude.json'), JSON.stringify({ ServerVersion: 'fixture', ToolVersion: 'fixture' }))
  return directory
}

afterEach(() => {
  while (tempDirectories.length) {
    const directory = tempDirectories.pop()
    if (directory.startsWith(tmpdir())) rmSync(directory, { recursive: true, force: true })
  }
})

describe('Wave 2 immutable export reader', () => {
  it('classifies all 26 routes from 15 artifacts and 11 explicit absent routes', () => {
    const directory = createFixture()
    const snapshot = inspectExportDirectory({
      directory,
      absentCollections: OBSERVED_ABSENT_COLLECTIONS
    })

    expect(DECLARED_COLLECTIONS).toHaveLength(26)
    expect(OBSERVED_PRESENT_COLLECTIONS).toHaveLength(15)
    expect(OBSERVED_ABSENT_COLLECTIONS).toHaveLength(11)
    expect(snapshot.manifest.routes).toHaveLength(26)
    expect(snapshot.manifest.routes.filter((route) => route.state === 'PRESENT')).toHaveLength(15)
    expect(snapshot.manifest.routes.filter((route) => route.state === 'ABSENT')).toHaveLength(11)
    expect(snapshot.manifest.artifacts).toHaveLength(31)
    expect(snapshot.manifest.snapshotId).toBe(`sha256:${snapshot.manifest.aggregateFingerprint}`)
  })

  it('produces a path and mtime independent aggregate fingerprint', () => {
    const firstDirectory = createFixture()
    const secondDirectory = createFixture()
    const first = inspectExportDirectory({
      directory: firstDirectory,
      absentCollections: OBSERVED_ABSENT_COLLECTIONS
    })
    const second = inspectExportDirectory({
      directory: secondDirectory,
      absentCollections: [...OBSERVED_ABSENT_COLLECTIONS].reverse()
    })

    expect(first.manifest.aggregateFingerprint).toBe(second.manifest.aggregateFingerprint)
    expect(JSON.stringify(first.manifest)).not.toContain(firstDirectory)
  })

  it('detects artifact tampering against a retained fingerprint', () => {
    const directory = createFixture()
    const original = inspectExportDirectory({
      directory,
      absentCollections: OBSERVED_ABSENT_COLLECTIONS
    })
    writeFileSync(
      join(directory, 'accounts.bson'),
      BSON.serialize({ _id: new ObjectId('000000000000000000000001'), fixtureCode: 'CHANGED_SAFE_VALUE' })
    )

    expect(() => inspectExportDirectory({
      directory,
      absentCollections: OBSERVED_ABSENT_COLLECTIONS,
      expectedAggregateFingerprint: original.manifest.aggregateFingerprint
    })).toThrow(/fingerprint mismatch/i)
  })

  it('rejects malformed and trailing BSON instead of silently truncating', () => {
    const valid = BSON.serialize({ _id: new ObjectId('000000000000000000000001') })
    expect(() => parseBsonSequence(valid.subarray(0, valid.length - 1), 'accounts')).toThrow(/malformed bson/i)
    expect(() => parseBsonSequence(Buffer.concat([valid, Buffer.from([1, 2, 3])]), 'accounts')).toThrow(/truncated length/i)
  })

  it('rejects unexpected collection artifacts', () => {
    const directory = createFixture()
    writeFileSync(join(directory, 'unexpected.bson'), BSON.serialize({ _id: new ObjectId() }))
    writeFileSync(join(directory, 'unexpected.metadata.json'), metadataFor('unexpected', 99))

    expect(() => inspectExportDirectory({
      directory,
      absentCollections: OBSERVED_ABSENT_COLLECTIONS
    })).toThrow(/unexpected collection artifact/i)
  })

  it('rejects missing routes unless absence is explicit', () => {
    const directory = createFixture()
    expect(() => inspectExportDirectory({ directory, absentCollections: [] }))
      .toThrow(/missing live route without explicit absent declaration/i)
    expect(() => inspectExportDirectory({ directory }))
      .toThrow(/must explicitly classify/i)
  })

  it('rejects metadata collection, UUID, and index mismatches', () => {
    const mismatchDirectory = createFixture({
      mutateMetadata(metadata, collection) {
        if (collection === 'accounts') metadata.collectionName = 'users'
      }
    })
    expect(() => inspectExportDirectory({
      directory: mismatchDirectory,
      absentCollections: OBSERVED_ABSENT_COLLECTIONS
    })).toThrow(/collectionName mismatch/i)

    const uuidDirectory = createFixture({
      mutateMetadata(metadata, collection) {
        if (collection === 'accounts') metadata.uuid = 'not-a-uuid'
      }
    })
    expect(() => inspectExportDirectory({
      directory: uuidDirectory,
      absentCollections: OBSERVED_ABSENT_COLLECTIONS
    })).toThrow(/invalid metadata uuid/i)

    const indexDirectory = createFixture({
      mutateMetadata(metadata, collection) {
        if (collection === 'accounts') metadata.indexes = []
      }
    })
    expect(() => inspectExportDirectory({
      directory: indexDirectory,
      absentCollections: OBSERVED_ABSENT_COLLECTIONS
    })).toThrow(/missing metadata indexes/i)
  })

  it('rejects invalid and duplicate source ObjectIds', () => {
    expect(() => parseBsonSequence(BSON.serialize({ _id: 'not-an-object-id' }), 'users'))
      .toThrow(/invalid objectid/i)
    const duplicate = BSON.serialize({ _id: new ObjectId('000000000000000000000001') })
    expect(() => parseBsonSequence(Buffer.concat([duplicate, duplicate]), 'users'))
      .toThrow(/duplicate _id/i)
  })

  it('keeps manifest authority and parsed records unchanged after nested mutation attempts', () => {
    const directory = createFixture({
      documentFor(collection, index) {
        return {
          _id: new ObjectId((index + 1).toString(16).padStart(24, '0')),
          nested: { values: ['SAFE', { code: 'ORIGINAL' }] }
        }
      }
    })
    const snapshot = inspectExportDirectory({
      directory,
      absentCollections: OBSERVED_ABSENT_COLLECTIONS
    })
    const fingerprint = snapshot.manifest.aggregateFingerprint
    const accountRoute = snapshot.manifest.routes.find((route) => route.collection === 'accounts')
    const originalIndexName = accountRoute.metadata.indexes[0].name
    const first = snapshot.getRecords('accounts')[0]

    expect(() => { accountRoute.metadata.indexes[0].name = 'MUTATED' }).toThrow()
    expect(() => { first.document.nested.values[1].code = 'MUTATED' }).toThrow()
    first.document._id.id[0] = 255

    const fresh = snapshot.getRecords('accounts')[0]
    expect(snapshot.manifest.aggregateFingerprint).toBe(fingerprint)
    expect(accountRoute.metadata.indexes[0].name).toBe(originalIndexName)
    expect(fresh.document.nested.values[1].code).toBe('ORIGINAL')
    expect(fresh.legacyId).toBe('000000000000000000000001')
  })

  it('rejects malformed manifest factory inputs and incomplete route state', () => {
    const hash = 'a'.repeat(64)
    const valid = {
      declaredCollections: ['users'],
      artifacts: [
        { name: 'users.bson', bytes: 1, sha256: hash },
        { name: 'users.metadata.json', bytes: 1, sha256: hash }
      ],
      routes: [{
        collection: 'users', state: 'PRESENT', documentCount: 1,
        bsonSha256: hash, metadataSha256: hash, metadata: { collectionName: 'users' }
      }]
    }
    expect(createExportManifest(valid).routes).toHaveLength(1)
    expect(() => createExportManifest({
      ...valid,
      artifacts: [...valid.artifacts, valid.artifacts[0]]
    })).toThrow(/duplicate artifact/i)
    expect(() => createExportManifest({
      ...valid,
      routes: [...valid.routes, valid.routes[0]]
    })).toThrow(/duplicate manifest route/i)
    expect(() => createExportManifest({
      ...valid,
      artifacts: [],
      routes: [{ collection: 'users', state: 'ABSENT', documentCount: 1 }]
    })).toThrow(/absent route contains/i)
    expect(() => createExportManifest({
      ...valid,
      artifacts: [{ ...valid.artifacts[0], bytes: -1 }, valid.artifacts[1]]
    })).toThrow(/nonnegative safe integer/i)
    expect(() => createExportManifest({
      ...valid,
      declaredCollections: ['users', 'accounts']
    })).toThrow(/completely cover/i)
    expect(() => createExportManifest({
      ...valid,
      artifacts: [{ ...valid.artifacts[0], sha256: 'not-a-hash' }, valid.artifacts[1]]
    })).toThrow(/sha-256 digest/i)
    expect(() => createExportManifest({
      ...valid,
      artifacts: [...valid.artifacts, { name: 'prelude.json', bytes: 1, sha256: hash }],
      prelude: { ServerVersion: 'fixture', ToolVersion: 'fixture', credential: 'unsafe-fixture-value' }
    })).toThrow(/only ServerVersion and ToolVersion/i)
    expect(() => createExportManifest({
      ...valid,
      artifacts: [...valid.artifacts, { name: 'prelude.json', bytes: 1, sha256: hash }],
      prelude: { ServerVersion: 8, ToolVersion: 'fixture' }
    })).toThrow(/string or null/i)
  })
})
