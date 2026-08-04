const { readFileSync, readdirSync } = require('node:fs')
const { join } = require('node:path')
const { BSON, ObjectId } = require('mongodb')
const { createExportManifest, deepFreeze, sha256 } = require('./wave2-export-manifest.cjs')

const DECLARED_COLLECTIONS = Object.freeze([
  'users', 'families', 'banks', 'categories', 'money_sources', 'accounts',
  'accumulations', 'savings_accounts', 'transactions', 'expenses', 'incomes',
  'transfers', 'contributions', 'loans', 'borrowings', 'collections',
  'repayments', 'contacts', 'budgets', 'notifications', 'user_notifications',
  'contribution_requests', 'group_payouts', 'invitations', 'proposal_expenses',
  'system_tasks'
])

const OBSERVED_PRESENT_COLLECTIONS = Object.freeze([
  'accounts', 'accumulations', 'banks', 'budgets', 'categories', 'contacts',
  'expenses', 'incomes', 'loans', 'money_sources', 'notifications',
  'system_tasks', 'transactions', 'users', 'user_notifications'
])

const OBSERVED_ABSENT_COLLECTIONS = Object.freeze([
  'families', 'savings_accounts', 'transfers', 'contributions', 'borrowings',
  'collections', 'repayments', 'contribution_requests', 'group_payouts',
  'invitations', 'proposal_expenses'
])

const UUID_PATTERN = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i
const validatedExportSnapshots = new WeakSet()

const assertPlainObject = (value, message) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message)
}

const deserializeBson = (raw) => BSON.deserialize(raw, {
  promoteLongs: false,
  promoteValues: false,
  promoteBuffers: false,
  validation: { utf8: true }
})

const deepFreezeDocument = (value) => {
  if (!value || typeof value !== 'object' || value._bsontype || value instanceof Date || Buffer.isBuffer(value)) return value
  for (const child of Object.values(value)) deepFreezeDocument(child)
  return Object.freeze(value)
}

const parseBsonFrames = (buffer, collection = 'unknown') => {
  if (!Buffer.isBuffer(buffer)) throw new TypeError('BSON input must be a Buffer')
  const frames = []
  const seenIds = new Set()
  let offset = 0

  while (offset < buffer.length) {
    const remaining = buffer.length - offset
    if (remaining < 5) {
      throw new Error(`Malformed BSON in ${collection}: truncated length at byte ${offset}`)
    }
    const documentLength = buffer.readInt32LE(offset)
    if (documentLength < 5 || documentLength > remaining) {
      throw new Error(`Malformed BSON in ${collection}: invalid document length at byte ${offset}`)
    }
    const end = offset + documentLength
    if (buffer[end - 1] !== 0) {
      throw new Error(`Malformed BSON in ${collection}: missing document terminator at byte ${end - 1}`)
    }

    const raw = buffer.subarray(offset, end)
    let document
    try {
      document = deserializeBson(raw)
    } catch (error) {
      throw new Error(`Malformed BSON in ${collection} at byte ${offset}: ${error.message}`)
    }

    if (!(document._id instanceof ObjectId) || !ObjectId.isValid(document._id)) {
      throw new Error(`Invalid ObjectId in ${collection} at document ${frames.length}`)
    }
    const legacyId = document._id.toHexString()
    if (seenIds.has(legacyId)) throw new Error(`Duplicate _id in ${collection}: ${legacyId}`)
    seenIds.add(legacyId)
    frames.push(Object.freeze({ raw: Buffer.from(raw), legacyId, sourceHash: sha256(raw) }))
    offset = end
  }

  if (offset !== buffer.length) throw new Error(`Malformed BSON in ${collection}: trailing bytes`)
  return Object.freeze(frames)
}

const exposeFrames = (frames) => Object.freeze(frames.map((frame) => Object.freeze({
  document: deepFreezeDocument(deserializeBson(frame.raw)),
  legacyId: frame.legacyId,
  sourceHash: frame.sourceHash
})))

const parseBsonSequence = (buffer, collection = 'unknown') => exposeFrames(parseBsonFrames(buffer, collection))

const parseMetadata = (buffer, expectedCollection) => {
  let metadata
  try {
    metadata = JSON.parse(buffer.toString('utf8'))
  } catch (error) {
    throw new Error(`Invalid metadata JSON for ${expectedCollection}: ${error.message}`)
  }
  assertPlainObject(metadata, `Invalid metadata object for ${expectedCollection}`)
  if (metadata.collectionName !== expectedCollection) {
    throw new Error(`Metadata collectionName mismatch for ${expectedCollection}`)
  }
  if (!UUID_PATTERN.test(metadata.uuid || '')) {
    throw new Error(`Invalid metadata UUID for ${expectedCollection}`)
  }
  if (metadata.type !== 'collection') {
    throw new Error(`Invalid metadata type for ${expectedCollection}`)
  }
  if (!Array.isArray(metadata.indexes) || metadata.indexes.length === 0) {
    throw new Error(`Missing metadata indexes for ${expectedCollection}`)
  }

  const names = new Set()
  for (const index of metadata.indexes) {
    assertPlainObject(index, `Invalid index metadata for ${expectedCollection}`)
    assertPlainObject(index.key, `Invalid index key for ${expectedCollection}`)
    if (typeof index.name !== 'string' || !index.name || names.has(index.name)) {
      throw new Error(`Invalid or duplicate index name for ${expectedCollection}`)
    }
    names.add(index.name)
  }
  if (!names.has('_id_')) throw new Error(`Missing _id index metadata for ${expectedCollection}`)

  return deepFreeze({
    collectionName: metadata.collectionName,
    uuid: metadata.uuid.toLowerCase().replaceAll('-', ''),
    type: metadata.type,
    indexes: metadata.indexes
  })
}

const inspectExportDirectory = ({
  directory,
  absentCollections,
  expectedAggregateFingerprint
}) => {
  if (!directory) throw new Error('Export directory is required')
  if (!Array.isArray(absentCollections)) {
    throw new Error('absentCollections must explicitly classify every missing declared route')
  }

  const declared = new Set(DECLARED_COLLECTIONS)
  const absent = new Set(absentCollections)
  if (absent.size !== absentCollections.length) throw new Error('absentCollections contains duplicates')
  for (const name of absent) {
    if (!declared.has(name)) throw new Error(`Unexpected absent collection declaration: ${name}`)
  }

  const files = readdirSync(directory, { withFileTypes: true })
  const regularFiles = files.filter((entry) => entry.isFile()).map((entry) => entry.name)
  const allowedAuxiliaryFiles = new Set(['prelude.json'])
  for (const name of regularFiles) {
    const bsonMatch = /^(.*)\.bson$/.exec(name)
    const metadataMatch = /^(.*)\.metadata\.json$/.exec(name)
    const collection = bsonMatch?.[1] || metadataMatch?.[1]
    if (collection && !declared.has(collection)) throw new Error(`Unexpected collection artifact: ${name}`)
    if (!collection && !allowedAuxiliaryFiles.has(name)) throw new Error(`Unexpected export artifact: ${name}`)
  }
  if (files.some((entry) => !entry.isFile())) throw new Error('Export directory must not contain nested entries')

  const names = new Set(regularFiles)
  const artifacts = []
  const routes = []
  const framesByCollection = new Map()
  const metadataUuids = new Set()

  for (const collection of DECLARED_COLLECTIONS) {
    const bsonName = `${collection}.bson`
    const metadataName = `${collection}.metadata.json`
    const hasBson = names.has(bsonName)
    const hasMetadata = names.has(metadataName)

    if (hasBson !== hasMetadata) throw new Error(`Unpaired BSON/metadata artifacts for ${collection}`)
    if (absent.has(collection)) {
      if (hasBson) throw new Error(`Collection declared absent but artifacts exist: ${collection}`)
      routes.push({ collection, state: 'ABSENT', documentCount: 0 })
      framesByCollection.set(collection, Object.freeze([]))
      continue
    }
    if (!hasBson) throw new Error(`Missing live route without explicit absent declaration: ${collection}`)

    const bsonBuffer = readFileSync(join(directory, bsonName))
    const metadataBuffer = readFileSync(join(directory, metadataName))
    const metadata = parseMetadata(metadataBuffer, collection)
    if (metadataUuids.has(metadata.uuid)) throw new Error(`Duplicate metadata UUID for ${collection}`)
    metadataUuids.add(metadata.uuid)
    const frames = parseBsonFrames(bsonBuffer, collection)
    framesByCollection.set(collection, frames)

    const bsonSha256 = sha256(bsonBuffer)
    const metadataSha256 = sha256(metadataBuffer)
    artifacts.push({ name: bsonName, bytes: bsonBuffer.length, sha256: bsonSha256 })
    artifacts.push({ name: metadataName, bytes: metadataBuffer.length, sha256: metadataSha256 })
    routes.push({
      collection,
      state: 'PRESENT',
      documentCount: frames.length,
      bsonSha256,
      metadataSha256,
      metadata
    })
  }

  let prelude = null
  if (names.has('prelude.json')) {
    const preludeBuffer = readFileSync(join(directory, 'prelude.json'))
    try {
      prelude = JSON.parse(preludeBuffer.toString('utf8'))
    } catch (error) {
      throw new Error(`Invalid prelude JSON: ${error.message}`)
    }
    assertPlainObject(prelude, 'Invalid prelude object')
    const preludeKeys = Object.keys(prelude)
    if (preludeKeys.some((key) => !['ServerVersion', 'ToolVersion'].includes(key)) ||
        preludeKeys.some((key) => typeof prelude[key] !== 'string')) {
      throw new Error('Prelude contains unsupported fields')
    }
    prelude = {
      ServerVersion: prelude.ServerVersion || null,
      ToolVersion: prelude.ToolVersion || null
    }
    artifacts.push({ name: 'prelude.json', bytes: preludeBuffer.length, sha256: sha256(preludeBuffer) })
  }

  const manifest = createExportManifest({
    artifacts,
    routes,
    prelude,
    declaredCollections: DECLARED_COLLECTIONS
  })
  if (expectedAggregateFingerprint && manifest.aggregateFingerprint !== expectedAggregateFingerprint) {
    throw new Error('Export aggregate fingerprint mismatch; source artifacts changed')
  }

  const getRecords = (collection) => {
    if (!declared.has(collection)) throw new Error(`Unknown declared collection: ${collection}`)
    return exposeFrames(framesByCollection.get(collection))
  }

  const snapshot = Object.freeze({
    manifest,
    getRecords
  })
  validatedExportSnapshots.add(snapshot)
  return snapshot
}

const assertValidatedExportSnapshot = (snapshot) => {
  if (!snapshot || !validatedExportSnapshots.has(snapshot)) {
    throw new TypeError('A reader-validated export snapshot is required')
  }
  return true
}

module.exports = {
  DECLARED_COLLECTIONS,
  OBSERVED_ABSENT_COLLECTIONS,
  OBSERVED_PRESENT_COLLECTIONS,
  assertValidatedExportSnapshot,
  inspectExportDirectory,
  parseBsonSequence,
  parseMetadata
}
