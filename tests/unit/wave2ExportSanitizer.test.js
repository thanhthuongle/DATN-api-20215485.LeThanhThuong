import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { Binary, BSON, Decimal128, Double, Int32, Long, ObjectId, Timestamp } from 'mongodb'
const require = createRequire(import.meta.url)
const reader = require('../../scripts/lib/wave2-export-reader.cjs')
const sanitizer = require('../../scripts/lib/wave2-export-sanitizer.cjs')

const {
  OBSERVED_ABSENT_COLLECTIONS,
  OBSERVED_PRESENT_COLLECTIONS,
  inspectExportDirectory
} = reader
const {
  SANITIZER_POLICY_VERSION,
  assertEvidenceSafe,
  assertRedactionManifestSafe,
  computeEvidenceFingerprint,
  sanitizeExportSnapshot,
  verifySanitizedEvidence
} = sanitizer
const tempDirectories = []

const makeSnapshot = ({
  password = '$2b$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  fixtureSuffix = '',
  userExtra = {},
  systemTaskExtra = {},
  collectionExtra = {}
} = {}) => {
  const directory = mkdtempSync(join(tmpdir(), 'wave2-sanitizer-test-'))
  tempDirectories.push(directory)
  OBSERVED_PRESENT_COLLECTIONS.forEach((collection, index) => {
    const base = {
      _id: new ObjectId((index + 1).toString(16).padStart(24, '0')),
      fixtureCode: `SAFE_${index}${fixtureSuffix}`
    }
    const specificExtra = collectionExtra[collection] || {}
    const document = collection === 'users'
      ? {
        ...base,
        email: 'private-person@example.invalid',
        username: 'private-person',
        displayName: 'Private Person',
        password,
        resetToken: 'fixture-secret-value',
        profile: {
          phoneNumber: '000-PRIVATE',
          note: 'private free text',
          credential: 'nested-fixture-secret'
        },
        ...userExtra,
        ...specificExtra
      }
      : collection === 'system_tasks'
        ? { ...base, ...systemTaskExtra, ...specificExtra }
        : { ...base, ...specificExtra }
    writeFileSync(join(directory, `${collection}.bson`), BSON.serialize(document))
    writeFileSync(join(directory, `${collection}.metadata.json`), JSON.stringify({
      indexes: [{ v: { $numberInt: '2' }, key: { _id: { $numberInt: '1' } }, name: '_id_' }],
      uuid: (index + 1).toString(16).padStart(32, '0'),
      collectionName: collection,
      type: 'collection'
    }))
  })
  return inspectExportDirectory({ directory, absentCollections: OBSERVED_ABSENT_COLLECTIONS })
}

afterEach(() => {
  while (tempDirectories.length) {
    const directory = tempDirectories.pop()
    if (directory.startsWith(tmpdir())) rmSync(directory, { recursive: true, force: true })
  }
})

describe('Wave 2 export evidence sanitizer', () => {
  it('rejects wrapper snapshots that forge documents, source hashes, or manifest authority', () => {
    const snapshot = makeSnapshot()
    const forgedDocument = { manifest: snapshot.manifest, getRecords: snapshot.getRecords }
    const forgedHash = { ...forgedDocument, sourceHash: 'a'.repeat(64) }
    const forgedManifest = { ...forgedDocument, manifest: { ...snapshot.manifest, aggregateFingerprint: 'b'.repeat(64) } }
    expect(() => sanitizeExportSnapshot(forgedDocument)).toThrow(/reader-validated/i)
    expect(() => sanitizeExportSnapshot(forgedHash)).toThrow(/reader-validated/i)
    expect(() => sanitizeExportSnapshot(forgedManifest)).toThrow(/reader-validated/i)
  })

  it('drops secrets and pseudonymizes direct identity and free text in evidence', () => {
    const sanitized = sanitizeExportSnapshot(makeSnapshot())
    const record = sanitized.getEvidenceRecords('users')[0]
    const serializedEvidence = JSON.stringify({
      manifest: sanitized.evidenceManifest,
      record
    })

    expect(record.policyVersion).toBe(SANITIZER_POLICY_VERSION)
    expect(record.sanitizedDocument.email).toMatch(/^person-[a-f0-9]{16}@example\.invalid$/)
    expect(record.sanitizedDocument.username).toMatch(/^\[IDENTITY:/)
    expect(record.sanitizedDocument).not.toHaveProperty('password')
    expect(record.sanitizedDocument).not.toHaveProperty('resetToken')
    expect(record.redactions.filter((redaction) => redaction.classification === 'SECRET').length).toBeGreaterThanOrEqual(3)
    expect(serializedEvidence).not.toContain('private-person')
    expect(serializedEvidence).not.toContain('fixture-secret-value')
    expect(serializedEvidence).not.toContain('nested-fixture-secret')
    expect(serializedEvidence).not.toContain('$2b$')
  })

  it('keeps only a valid bcrypt password in the separate in-memory operational view', () => {
    const sanitized = sanitizeExportSnapshot(makeSnapshot())
    const operational = sanitized.getOperationalRecords('users')[0]

    expect(operational.password).toMatch(/^\$2b\$/)
    expect(operational).not.toHaveProperty('resetToken')
    expect(operational.profile).not.toHaveProperty('credential')
    expect(JSON.stringify(sanitized)).not.toContain('$2b$')
    expect(JSON.stringify(sanitized.evidenceManifest)).not.toContain('password')

    const invalid = sanitizeExportSnapshot(makeSnapshot({ password: 'invalid-fixture-password' }))
    expect(invalid.getOperationalRecords('users')[0]).not.toHaveProperty('password')
    expect(JSON.stringify(invalid.getEvidenceRecords('users'))).not.toContain('invalid-fixture-password')
  })

  it('is deterministic for the same immutable source snapshot', () => {
    const snapshot = makeSnapshot()
    const first = sanitizeExportSnapshot(snapshot)
    const second = sanitizeExportSnapshot(snapshot)

    expect(first.evidenceManifest).toEqual(second.evidenceManifest)
    expect(first.getEvidenceRecords('users')).toEqual(second.getEvidenceRecords('users'))
    expect(first.evidenceManifest.routes).toHaveLength(26)
    expect(verifySanitizedEvidence(first)).toBe(true)
  })

  it('binds ordered per-record content hashes even when route counts do not change', () => {
    const first = sanitizeExportSnapshot(makeSnapshot({ fixtureSuffix: '_A' }))
    const second = sanitizeExportSnapshot(makeSnapshot({ fixtureSuffix: '_B' }))

    expect(first.evidenceManifest.routes).toEqual(second.evidenceManifest.routes)
    expect(first.evidenceManifest.recordTuples).toHaveLength(second.evidenceManifest.recordTuples.length)
    expect(first.evidenceManifest.recordTuples[0].sourceHash)
      .not.toBe(second.evidenceManifest.recordTuples[0].sourceHash)
    expect(first.evidenceManifest.evidenceFingerprint)
      .not.toBe(second.evidenceManifest.evidenceFingerprint)
    expect(verifySanitizedEvidence(first)).toBe(true)
    expect(verifySanitizedEvidence(second)).toBe(true)
  })

  it('binds exact canonical route summaries and rejects duplicate or omitted routes', () => {
    const sanitized = sanitizeExportSnapshot(makeSnapshot())
    const manifest = sanitized.evidenceManifest
    const input = {
      version: manifest.version,
      sourceSnapshotId: manifest.sourceSnapshotId,
      sourceAggregateFingerprint: manifest.sourceAggregateFingerprint,
      routes: manifest.routes,
      sourceRoutes: manifest.sourceRoutes,
      recordTuples: manifest.recordTuples
    }
    const changedRoutes = manifest.routes.map((route) => ({ ...route }))
    changedRoutes[0].redactionCount += 1

    expect(computeEvidenceFingerprint(input)).toBe(manifest.evidenceFingerprint)
    expect(computeEvidenceFingerprint({ ...input, routes: changedRoutes }))
      .not.toBe(manifest.evidenceFingerprint)
    expect(() => computeEvidenceFingerprint({
      ...input,
      routes: [manifest.routes[0], manifest.routes[0], ...manifest.routes.slice(2)]
    })).toThrow(/canonical declared order/i)
    expect(() => computeEvidenceFingerprint({
      ...input,
      routes: manifest.routes.filter((route) => route.collection !== 'families')
    })).toThrow(/exactly cover/i)
    expect(() => computeEvidenceFingerprint({
      ...input,
      routes: manifest.routes.filter((route) => route.collection !== 'users')
    })).toThrow(/exactly cover/i)
  })

  it('defensively protects manifest, sanitized evidence, and source authority from mutation', () => {
    const snapshot = makeSnapshot()
    const sanitized = sanitizeExportSnapshot(snapshot)
    const fingerprint = sanitized.evidenceManifest.evidenceFingerprint
    const records = sanitized.getEvidenceRecords('users')
    const originalEmail = records[0].sanitizedDocument.email

    expect(() => { sanitized.evidenceManifest.recordTuples[0].sourceHash = 'b'.repeat(64) }).toThrow()
    expect(() => { records[0].sanitizedDocument.email = 'changed@example.invalid' }).toThrow()
    expect(() => { records[0].redactions[0].path = 'changed' }).toThrow()

    expect(sanitized.evidenceManifest.evidenceFingerprint).toBe(fingerprint)
    expect(sanitized.getEvidenceRecords('users')[0].sanitizedDocument.email).toBe(originalEmail)
    expect(snapshot.getRecords('users')[0].document.email).toBe('private-person@example.invalid')
    expect(verifySanitizedEvidence(sanitized)).toBe(true)
  })

  it('fails closed for links, nested opaque job data, aliases, and unclassified strings while preserving shape', () => {
    const sanitized = sanitizeExportSnapshot(makeSnapshot({
      userExtra: {
        notificationLink: 'https://private.invalid/path?token=fixture-link-secret',
        contactEmail: 'alias-person@example.invalid',
        opaque: ['opaque-canary', null, ['nested-canary']],
        bearerValue: 'fixture-bearer-secret'
      },
      systemTaskExtra: {
        data: {
          unknownAlias: 'job-private-canary',
          nested: [{ searchQuery: 'email=private@example.invalid' }, null]
        }
      }
    }))
    const user = sanitized.getEvidenceRecords('users')[0].sanitizedDocument
    const task = sanitized.getEvidenceRecords('system_tasks')[0].sanitizedDocument
    const serialized = JSON.stringify({ user, task })
    const dynamicUserValues = Object.entries(user)
      .filter(([key]) => /^field_[a-f0-9]{16}$/.test(key))
      .map(([, value]) => value)
    const opaqueArray = dynamicUserValues.find((value) => Array.isArray(value) && value.length === 3)
    const taskNestedArray = Object.values(task.data).find((value) => Array.isArray(value))

    expect(dynamicUserValues.some((value) => /^\[MEDIA:/.test(value))).toBe(true)
    expect(dynamicUserValues.some((value) => /^person-/.test(value))).toBe(true)
    expect(opaqueArray).toHaveLength(3)
    expect(opaqueArray[1]).toBeNull()
    expect(opaqueArray[2]).toHaveLength(1)
    expect(taskNestedArray).toHaveLength(2)
    expect(taskNestedArray[1]).toBeNull()
    expect(serialized).not.toMatch(/fixture-link-secret|alias-person|opaque-canary|nested-canary|fixture-bearer-secret|job-private-canary|private@example/i)
    expect(() => assertEvidenceSafe({ currency: 'raw unclassified canary' }, { collection: 'users' }))
      .toThrow(/unclassified string/i)
    expect(verifySanitizedEvidence(sanitized)).toBe(true)
  })

  it('pseudonymizes adversarial dynamic object keys without leaking them into redaction paths', () => {
    const sanitized = sanitizeExportSnapshot(makeSnapshot({
      systemTaskExtra: {
        data: {
          'person-key@example.invalid': 'first-private-value',
          'https://private.invalid/path': 'second-private-value',
          'private free-text key': 'third-private-value',
          'token=private-key-value': 'fourth-private-value',
          alice: 'safe-identifier-person-value',
          nested: [
            { 'nested-person@example.invalid': 'nested-private-value' },
            { john_doe: 'nested-safe-identifier-value' }
          ]
        }
      }
    }))
    const record = sanitized.getEvidenceRecords('system_tasks')[0]
    const serialized = JSON.stringify(record)
    const dynamicKeys = Object.keys(record.sanitizedDocument.data)
    const nestedArray = Object.values(record.sanitizedDocument.data).find((value) => Array.isArray(value))

    expect(record.sanitizedDocument).toHaveProperty('data')
    expect(dynamicKeys.every((key) => /^field_[a-f0-9]{16}$/.test(key))).toBe(true)
    expect(nestedArray).toHaveLength(2)
    expect(Object.keys(nestedArray[0])[0]).toMatch(/^field_[a-f0-9]{16}$/)
    expect(Object.keys(nestedArray[1])[0]).toMatch(/^field_[a-f0-9]{16}$/)
    expect(serialized).not.toMatch(/person-key|private\.invalid|private free-text|token=|nested-person|private-value|alice|john_doe|safe-identifier/i)
    expect(record.redactions.every((redaction) => !/[?=@\s/]/.test(redaction.path))).toBe(true)
    expect(() => assertEvidenceSafe({ 'raw@example.invalid': 'value' }, { collection: 'system_tasks' }))
      .toThrow(/object key/i)
    expect(() => assertRedactionManifestSafe([
      { path: 'data.raw@example.invalid', action: 'PSEUDONYMIZE_KEY', classification: 'DYNAMIC_OBJECT_KEY' }
    ])).toThrow(/redaction manifest entry/i)
    expect(verifySanitizedEvidence(sanitized)).toBe(true)
  })

  it('uses distinct canonical tags for BSON numerics and digest-only binary evidence', () => {
    const sanitized = sanitizeExportSnapshot(makeSnapshot({
      userExtra: {
        intValue: new Int32(1),
        longValue: Long.fromNumber(1),
        doubleValue: new Double(1),
        decimalValue: Decimal128.fromString('1.0'),
        timestampValue: new Timestamp({ t: 12, i: 3 }),
        binaryValue: new Binary(Buffer.from('safe-binary-fixture'), 2),
        nullableValue: null,
        arrayValue: [new Int32(1), null, new Double(1)]
      }
    }))
    const document = sanitized.getEvidenceRecords('users')[0].sanitizedDocument
    const documentValues = Object.values(document)
    const intValue = documentValues.find((value) => value?.$numberInt)
    const longValue = documentValues.find((value) => value?.$numberLong)
    const doubleValue = documentValues.find((value) => value?.$numberDouble)
    const decimalValue = documentValues.find((value) => value?.$numberDecimal)
    const timestampValue = documentValues.find((value) => value?.$timestamp)
    const binaryValue = documentValues.find((value) => value?.$binary)
    const arrayValue = documentValues.find((value) => Array.isArray(value))

    expect(intValue).toEqual({ $numberInt: '1' })
    expect(longValue).toEqual({ $numberLong: '1' })
    expect(doubleValue).toEqual({ $numberDouble: '1' })
    expect(decimalValue).toEqual({ $numberDecimal: '1.0' })
    expect(timestampValue).toEqual({ $timestamp: { t: 12, i: 3 } })
    expect(binaryValue.$binary).toMatchObject({ subType: '02', length: 19 })
    expect(binaryValue.$binary.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(binaryValue)).not.toContain('safe-binary-fixture')
    expect(documentValues).toContain(null)
    expect(arrayValue).toHaveLength(3)
    expect(arrayValue[1]).toBeNull()
    expect(new Set([
      JSON.stringify(intValue),
      JSON.stringify(longValue),
      JSON.stringify(doubleValue),
      JSON.stringify(decimalValue)
    ]).size).toBe(4)
    expect(verifySanitizedEvidence(sanitized)).toBe(true)
  })

  it('preserves exact declared root and budgets.categories keys while pseudonymizing unknown keys', () => {
    const categoryId = new ObjectId('0000000000000000000000aa')
    const sanitized = sanitizeExportSnapshot(makeSnapshot({
      collectionExtra: {
        budgets: {
          ownerType: 'individual',
          ownerId: new ObjectId('000000000000000000000001'),
          categories: [{
            categoryId,
            categoryName: 'Private category label',
            icon: 'private-icon',
            childrenIds: [],
            parentIds: [],
            amount: new Int32(10),
            repeat: true,
            transactionIds: [],
            alice: 'private-dynamic-value'
          }]
        }
      }
    }))
    const user = sanitized.getEvidenceRecords('users')[0].sanitizedDocument
    const budget = sanitized.getEvidenceRecords('budgets')[0].sanitizedDocument
    const category = budget.categories[0]

    expect(user).toHaveProperty('_id')
    expect(user).toHaveProperty('email')
    expect(user).toHaveProperty('username')
    expect(user).toHaveProperty('displayName')
    expect(budget).toHaveProperty('ownerType')
    expect(budget).toHaveProperty('ownerId')
    expect(budget).toHaveProperty('categories')
    expect(category).toHaveProperty('categoryId')
    expect(category).toHaveProperty('categoryName')
    expect(category).toHaveProperty('icon')
    expect(category).toHaveProperty('childrenIds')
    expect(category).toHaveProperty('parentIds')
    expect(category).toHaveProperty('amount')
    expect(category).toHaveProperty('repeat')
    expect(category).toHaveProperty('transactionIds')
    expect(category).not.toHaveProperty('alice')
    expect(Object.keys(category).some((key) => /^field_[a-f0-9]{16}$/.test(key))).toBe(true)
    expect(JSON.stringify(category)).not.toMatch(/alice|private-dynamic-value/i)
    expect(verifySanitizedEvidence(sanitized)).toBe(true)
  })
})
