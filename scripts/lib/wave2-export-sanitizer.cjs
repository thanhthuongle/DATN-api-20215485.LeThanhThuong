const { Binary, BSON, Decimal128, Double, Int32, Long, ObjectId, Timestamp } = require('mongodb')
const { canonicalJson, createExportManifest, deepFreeze, sha256, SHA256_PATTERN } = require('./wave2-export-manifest.cjs')
const { DECLARED_COLLECTIONS, assertValidatedExportSnapshot } = require('./wave2-export-reader.cjs')

const SANITIZER_POLICY_VERSION = 'wave2-evidence-sanitizer-v3'
const operationalSanitizedSnapshots = new WeakSet()
const BCRYPT_PATTERN = /^\$2[aby]\$(?:0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/
const SECRET_FIELD_PATTERN = /(?:password|passwd|pwd|token|secret|credential|authorization|cookie|session|otp|verification.?code|api.?key|private.?key|bearer|jwt|nonce|signature)/i
const IDENTITY_FIELD_PATTERN = /(?:email|phone|phoneNumber|username|displayName|firstName|lastName|fullName|address)$/i
const FREE_TEXT_FIELD_PATTERN = /(?:name|title|note|notes|description|content|message|reason)$/i
const LINK_FIELD_PATTERN = /(?:avatar|photo|image|images|icon|logo|url|uri|link|href|query|redirect|callback)s?$/i
const PSEUDONYM_PATTERN = /^\[(?:IDENTITY|TEXT|MEDIA|UNCLASSIFIED):[a-f0-9]{16}\]$/
const PSEUDONYM_EMAIL_PATTERN = /^person-[a-f0-9]{16}@example\.invalid$/
const SAFE_TOKEN_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/
const SAFE_ENUM_PATH_PATTERN = /(?:^|\.)(?:ownerType|type|status|currency|language|startDayOfWeek|trustLevel|jobType|action|priority)$/i
const SAFE_ID_PATH_PATTERN = /(?:Id|Ids)(?:\[\d+\])?$/
const SAFE_DATE_PATH_PATTERN = /(?:At|Time|Date)$/
const SAFE_REDACTION_PATH_PATTERN = /^[_A-Za-z][_A-Za-z0-9]*(?:(?:\.[_A-Za-z][_A-Za-z0-9]*)|(?:\[\d+\]))*$/
const REDACTION_ACTIONS = new Set(['DROP', 'PSEUDONYMIZE', 'REDACT', 'PSEUDONYMIZE_KEY'])
const REDACTION_CLASSIFICATIONS = new Set([
  'SECRET', 'DIRECT_IDENTITY', 'MEDIA_LINK_OR_QUERY', 'FREE_TEXT',
  'UNCLASSIFIED_STRING', 'DYNAMIC_OBJECT_KEY'
])

const fields = (...names) => new Set(['_id', ...names])
const DECLARED_ROOT_FIELDS = Object.freeze({
  users: fields('email', 'password', 'username', 'displayName', 'avatar', 'isActive', 'verifyToken',
    'language', 'currency', 'remindToInput', 'remindTime', 'startDayOfWeek', 'startDayOfMonth',
    'createdAt', 'updatedAt', '_destroy'),
  families: fields('familyName', 'backgroundImage', 'ownerId', 'managerIds', 'memberIds',
    'createdAt', 'updatedAt', '_destroy'),
  banks: fields('code', 'name', 'logo', 'createdAt', 'updatedAt', '_destroy'),
  categories: fields('ownerType', 'ownerId', 'name', 'type', 'allowDelete', 'icon', 'childrenIds',
    'parentIds', 'createdAt', 'updatedAt', '_destroy'),
  money_sources: fields('ownerType', 'ownerId', 'accountIds', 'savings_accountIds', 'accumulationIds',
    'createdAt', 'updatedAt', '_destroy'),
  accounts: fields('ownerType', 'ownerId', 'moneySourceId', 'type', 'accountName', 'initBalance',
    'balance', 'bankId', 'description', 'icon', 'isBlock', 'transactionIds',
    'createdAt', 'updatedAt', '_destroy'),
  accumulations: fields('ownerType', 'ownerId', 'moneySourceId', 'accumulationName', 'balance',
    'targetBalance', 'startDate', 'endDate', 'isFinish', 'transactionIds', 'description',
    'createdAt', 'updatedAt', '_destroy'),
  savings_accounts: fields('ownerType', 'ownerId', 'moneySourceId', 'savingsAccountName', 'bankId',
    'initBalance', 'balance', 'rate', 'nonTermRate', 'startDate', 'term', 'interestPaid', 'termEnded',
    'interestPaidTargetId', 'interestPaidTargetType', 'description', 'isClosed', 'isRolledOver',
    'parentSavingId', 'transactionIds', 'moneyFromType', 'moneyFromId',
    'createdAt', 'updatedAt', '_destroy'),
  transactions: fields('ownerType', 'ownerId', 'responsiblePersonId', 'proposalId', 'type', 'categoryId',
    'name', 'description', 'amount', 'transactionTime', 'createdAt', 'updatedAt', '_destroy'),
  expenses: fields('transactionId', 'moneyFromType', 'moneyFromId', 'images', 'createdAt', 'updatedAt', '_destroy'),
  incomes: fields('transactionId', 'moneyTargetType', 'moneyTargetId', 'images', 'createdAt', 'updatedAt', '_destroy'),
  transfers: fields('transactionId', 'moneyFromType', 'moneyFromId', 'moneyTargetType', 'moneyTargetId',
    'fee', 'images', 'createdAt', 'updatedAt', '_destroy'),
  contributions: fields('transactionId', 'recipientId', 'moneyFromType', 'moneyFromId', 'moneyTargetType',
    'moneyTargetId', 'contributionRequestId', 'images', 'createdAt', 'updatedAt', '_destroy'),
  loans: fields('transactionId', 'moneyFromType', 'moneyFromId', 'borrowerId', 'rate', 'collectTime',
    'trustLevel', 'images', 'createdAt', 'updatedAt', '_destroy'),
  borrowings: fields('transactionId', 'moneyTargetType', 'moneyTargetId', 'lenderId', 'rate',
    'repaymentTime', 'images', 'createdAt', 'updatedAt', '_destroy'),
  collections: fields('transactionId', 'loanTransactionId', 'borrowerId', 'moneyTargetType',
    'moneyTargetId', 'realCollectTime', 'images', 'createdAt', 'updatedAt', '_destroy'),
  repayments: fields('transactionId', 'borrowingTransactionId', 'lenderId', 'moneyFromType',
    'moneyFromId', 'realRepaymentTime', 'images', 'createdAt', 'updatedAt', '_destroy'),
  contacts: fields('ownerType', 'ownerId', 'name', 'trustLevel', 'createdAt', 'updatedAt', '_destroy'),
  budgets: fields('ownerType', 'ownerId', 'startTime', 'endTime', 'categories',
    'createdAt', 'updatedAt', '_destroy'),
  notifications: fields('title', 'message', 'type', 'link', 'createdAt', 'updatedAt', '_destroy'),
  user_notifications: fields('userId', 'notificationId', 'isRead', 'readAt', 'receiveAt'),
  contribution_requests: fields('ownerType', 'ownerId', 'familyId', 'name', 'description', 'amount',
    'moneyTargetType', 'moneyTargetId', 'deadline', 'contributerIds', 'createdAt', 'updatedAt', '_destroy'),
  group_payouts: fields('transactionId', 'recipientId', 'moneyFromType', 'moneyFromId', 'moneyTargetType',
    'moneyTargetId', 'images', 'createdAt', 'updatedAt', '_destroy'),
  invitations: fields('inviterId', 'inviteeId', 'familyId', 'status', 'createdAt', 'updatedAt', '_destroy'),
  proposal_expenses: fields('ownerType', 'ownerId', 'targetId', 'name', 'amount', 'categoryId',
    'description', 'status', 'images', 'reviewerId', 'reviewed_at', 'createdAt', 'updatedAt', '_destroy'),
  system_tasks: fields('type', 'data', 'scheduleTime', 'repeat', 'status', 'createdAt', 'updatedAt', '_destroy',
    'name', 'priority', 'nextRunAt', 'lockedAt', 'lastModifiedBy', 'lastRunAt', 'lastFinishedAt',
    'failedAt', 'failCount', 'failReason', 'repeatInterval', 'repeatTimezone', 'repeatAt',
    'shouldSaveResult', 'result', 'disabled')
})

const BUDGET_CATEGORY_FIELDS = new Set([
  'categoryId', 'categoryName', 'icon', 'childrenIds', 'parentIds', 'amount', 'repeat', 'transactionIds'
])

const isDeclaredField = ({ collection, path, key }) => {
  if (!path) return DECLARED_ROOT_FIELDS[collection]?.has(key) === true
  if (collection === 'budgets' && /^categories\[\d+\]$/.test(path)) return BUDGET_CATEGORY_FIELDS.has(key)
  return false
}

const cloneFrozenJson = (value) => deepFreeze(JSON.parse(canonicalJson(value)))

const bsonToEvidenceScalar = (value) => {
  if (value instanceof ObjectId) return { $oid: value.toHexString() }
  if (value instanceof Date) return { $date: value.toISOString() }
  if (value instanceof Timestamp) {
    return { $timestamp: { t: value.getHighBitsUnsigned(), i: value.getLowBitsUnsigned() } }
  }
  if (value instanceof Int32) return { $numberInt: value.toString() }
  if (value instanceof Long) return { $numberLong: value.toString() }
  if (value instanceof Double) return { $numberDouble: value.toString() }
  if (value instanceof Decimal128) return { $numberDecimal: value.toString() }
  if (value instanceof Binary || Buffer.isBuffer(value)) {
    const bytes = Buffer.from(value instanceof Binary ? value.buffer : value)
    const subType = value instanceof Binary ? value.sub_type.toString(16).padStart(2, '0') : '00'
    return { $binary: { subType, length: bytes.length, sha256: sha256(bytes) } }
  }
  if (value && typeof value === 'object' && value._bsontype) {
    return { $unsupportedBsonType: String(value._bsontype) }
  }
  return value
}

const pseudonym = ({ collection, legacyId, path, kind }) => {
  const identity = `${SANITIZER_POLICY_VERSION}|${collection}|${legacyId}|${path}|${kind}`
  const suffix = sha256(identity).slice(0, 16)
  if (kind === 'email') return `person-${suffix}@example.invalid`
  return `[${kind.toUpperCase()}:${suffix}]`
}

const isSafeStructuralString = ({ collection, path, value }) => {
  if (SAFE_ID_PATH_PATTERN.test(path) && /^[a-f0-9]{24}$/i.test(value)) return true
  if (SAFE_DATE_PATH_PATTERN.test(path) && !Number.isNaN(Date.parse(value))) return true
  if (SAFE_ENUM_PATH_PATTERN.test(path) && SAFE_TOKEN_PATTERN.test(value)) return true
  if (collection === 'banks' && path === 'code' && SAFE_TOKEN_PATTERN.test(value)) return true
  if (collection === 'system_tasks' && path === 'name' && SAFE_TOKEN_PATTERN.test(value)) return true
  return false
}

const sanitizeObjectKey = ({ key, collection, legacyId, path, redactions }) => {
  if (isDeclaredField({ collection, path, key })) {
    return { key, path: path ? `${path}.${key}` : key }
  }

  const suffix = sha256(`${SANITIZER_POLICY_VERSION}|${collection}|${legacyId}|${path}|object-key|${key}`).slice(0, 16)
  const sanitizedKey = `field_${suffix}`
  const sanitizedPath = path ? `${path}.${sanitizedKey}` : sanitizedKey
  redactions.push({
    path: sanitizedPath,
    action: 'PSEUDONYMIZE_KEY',
    classification: 'DYNAMIC_OBJECT_KEY'
  })
  return { key: sanitizedKey, path: sanitizedPath }
}

const pseudonymizeShape = ({ value, collection, legacyId, path, kind, classification, redactions }) => {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) {
    return value.map((item, index) => pseudonymizeShape({
      value: item,
      collection,
      legacyId,
      path: `${path}[${index}]`,
      kind,
      classification,
      redactions
    }))
  }
  if (typeof value === 'string') {
    redactions.push({ path, action: 'PSEUDONYMIZE', classification })
    return pseudonym({ collection, legacyId, path, kind })
  }
  if (value && typeof value === 'object' && !value._bsontype && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    return sanitizeValue({ value, collection, legacyId, path, redactions })
  }
  redactions.push({ path, action: 'REDACT', classification })
  return pseudonym({ collection, legacyId, path, kind })
}

const sanitizeValue = ({ value, collection, legacyId, path = '', redactions }) => {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue({
      value: item,
      collection,
      legacyId,
      path: `${path}[${index}]`,
      redactions
    }))
  }
  if (typeof value === 'string') {
    if (isSafeStructuralString({ collection, path, value })) return value
    redactions.push({ path, action: 'PSEUDONYMIZE', classification: 'UNCLASSIFIED_STRING' })
    return pseudonym({ collection, legacyId, path, kind: 'unclassified' })
  }
  if (typeof value !== 'object' || value instanceof Date || value._bsontype || Buffer.isBuffer(value)) {
    return bsonToEvidenceScalar(value)
  }

  const sanitized = {}
  for (const [key, child] of Object.entries(value)) {
    const sanitizedKey = sanitizeObjectKey({ key, collection, legacyId, path, redactions })
    const childPath = sanitizedKey.path
    if (SECRET_FIELD_PATTERN.test(key)) {
      redactions.push({ path: childPath, action: 'DROP', classification: 'SECRET' })
      continue
    }
    if (child === null || child === undefined) {
      sanitized[sanitizedKey.key] = child
      continue
    }
    if (IDENTITY_FIELD_PATTERN.test(key)) {
      const kind = /email$/i.test(key) ? 'email' : 'identity'
      sanitized[sanitizedKey.key] = pseudonymizeShape({
        value: child, collection, legacyId, path: childPath, kind,
        classification: 'DIRECT_IDENTITY', redactions
      })
      continue
    }
    if (LINK_FIELD_PATTERN.test(key)) {
      sanitized[sanitizedKey.key] = pseudonymizeShape({
        value: child, collection, legacyId, path: childPath, kind: 'media',
        classification: 'MEDIA_LINK_OR_QUERY', redactions
      })
      continue
    }
    if (FREE_TEXT_FIELD_PATTERN.test(key) && !(collection === 'system_tasks' && childPath === 'name')) {
      sanitized[sanitizedKey.key] = pseudonymizeShape({
        value: child, collection, legacyId, path: childPath, kind: 'text',
        classification: 'FREE_TEXT', redactions
      })
      continue
    }
    sanitized[sanitizedKey.key] = sanitizeValue({ value: child, collection, legacyId, path: childPath, redactions })
  }
  return sanitized
}

const assertRedactionManifestSafe = (redactions) => {
  if (!Array.isArray(redactions)) throw new Error('Evidence safety scan rejected redaction manifest')
  for (const redaction of redactions) {
    if (!redaction || typeof redaction !== 'object' || Array.isArray(redaction) ||
        canonicalJson(Object.keys(redaction).sort()) !== canonicalJson(['action', 'classification', 'path']) ||
        !SAFE_REDACTION_PATH_PATTERN.test(redaction.path || '') ||
        !REDACTION_ACTIONS.has(redaction.action) ||
        !REDACTION_CLASSIFICATIONS.has(redaction.classification)) {
      throw new Error('Evidence safety scan rejected redaction manifest entry')
    }
  }
}

const assertEvidenceSafe = (value, { collection, path = '' }) => {
  if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') return
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertEvidenceSafe(item, { collection, path: `${path}[${index}]` }))
    return
  }
  if (typeof value === 'string') {
    if (PSEUDONYM_PATTERN.test(value) || PSEUDONYM_EMAIL_PATTERN.test(value) ||
        isSafeStructuralString({ collection, path, value })) return
    throw new Error(`Evidence safety scan rejected unclassified string at ${collection}.${path}`)
  }
  if (!value || typeof value !== 'object') throw new Error(`Evidence safety scan rejected value at ${collection}.${path}`)

  const keys = Object.keys(value)
  if (keys.length === 1 && keys[0] === '$oid' && /^[a-f0-9]{24}$/.test(value.$oid)) return
  if (keys.length === 1 && keys[0] === '$date' && !Number.isNaN(Date.parse(value.$date))) return
  if (keys.length === 1 && ['$numberInt', '$numberLong', '$numberDouble', '$numberDecimal'].includes(keys[0]) &&
      typeof value[keys[0]] === 'string') return
  if (keys.length === 1 && keys[0] === '$timestamp' && Number.isSafeInteger(value.$timestamp?.t) &&
      Number.isSafeInteger(value.$timestamp?.i)) return
  if (keys.length === 1 && keys[0] === '$binary' && /^[a-f0-9]{2}$/.test(value.$binary?.subType) &&
      Number.isSafeInteger(value.$binary?.length) && value.$binary.length >= 0 &&
      SHA256_PATTERN.test(value.$binary?.sha256 || '')) return
  if (keys.length === 1 && keys[0] === '$unsupportedBsonType' && SAFE_TOKEN_PATTERN.test(value.$unsupportedBsonType)) return

  for (const [key, child] of Object.entries(value)) {
    if ((/^field_[a-f0-9]{16}$/.test(key) === false && !isDeclaredField({ collection, path, key })) ||
        SECRET_FIELD_PATTERN.test(key)) {
      throw new Error(`Evidence safety scan rejected object key at ${collection}.${path}`)
    }
    const childPath = path ? `${path}.${key}` : key
    assertEvidenceSafe(child, { collection, path: childPath })
  }
}

const createOperationalValue = (value) => {
  if (Array.isArray(value)) return Object.freeze(value.map(createOperationalValue))
  if (!value || typeof value !== 'object' || value instanceof Date || value._bsontype || Buffer.isBuffer(value)) return value

  const operational = {}
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_FIELD_PATTERN.test(key)) {
      if (/password/i.test(key) && typeof child === 'string' && BCRYPT_PATTERN.test(child)) {
        operational[key] = child
      }
      continue
    }
    operational[key] = createOperationalValue(child)
  }
  return Object.freeze(operational)
}

const validateRouteSummaries = (routes) => {
  if (!Array.isArray(routes) || routes.length !== DECLARED_COLLECTIONS.length) {
    throw new Error('Evidence routes must exactly cover declared collections')
  }
  return routes.map((route, index) => {
    if (!route || route.collection !== DECLARED_COLLECTIONS[index] ||
        !Number.isSafeInteger(route.recordCount) || route.recordCount < 0 ||
        !Number.isSafeInteger(route.redactionCount) || route.redactionCount < 0) {
      throw new Error('Evidence routes must be unique and in canonical declared order')
    }
    return {
      collection: route.collection,
      recordCount: route.recordCount,
      redactionCount: route.redactionCount
    }
  })
}

const validateSourceRoutes = (sourceRoutes) => {
  if (!Array.isArray(sourceRoutes) || sourceRoutes.length !== DECLARED_COLLECTIONS.length) {
    throw new Error('Evidence source routes must exactly cover declared collections')
  }
  return sourceRoutes.map((route, index) => {
    if (!route || route.collection !== DECLARED_COLLECTIONS[index] ||
        !['PRESENT', 'ABSENT'].includes(route.state) || !Number.isSafeInteger(route.documentCount) ||
        route.documentCount < 0 || (route.state === 'ABSENT' && route.documentCount !== 0)) {
      throw new Error('Evidence source routes must be canonical and valid')
    }
    return { collection: route.collection, state: route.state, documentCount: route.documentCount }
  })
}

const computeEvidenceFingerprint = ({ version, sourceSnapshotId, sourceAggregateFingerprint, routes, sourceRoutes, recordTuples }) => {
  if (version !== SANITIZER_POLICY_VERSION || typeof sourceSnapshotId !== 'string' ||
      !SHA256_PATTERN.test(sourceAggregateFingerprint || '') || !Array.isArray(recordTuples)) {
    throw new Error('Invalid evidence fingerprint input')
  }
  const canonicalRoutes = validateRouteSummaries(routes)
  const canonicalSourceRoutes = validateSourceRoutes(sourceRoutes)
  const tupleCounts = new Map(DECLARED_COLLECTIONS.map((collection) => [collection, 0]))
  const identities = new Set()
  for (const tuple of recordTuples) {
    if (!DECLARED_COLLECTIONS.includes(tuple.collection) || !/^[a-f0-9]{24}$/.test(tuple.sourceLegacyId || '') ||
        !SHA256_PATTERN.test(tuple.sourceHash || '') || !SHA256_PATTERN.test(tuple.sanitizedDocumentHash || '') ||
        tuple.policyVersion !== SANITIZER_POLICY_VERSION || !SHA256_PATTERN.test(tuple.redactionManifestHash || '') ||
        !SHA256_PATTERN.test(tuple.operationalDocumentHash || '')) {
      throw new Error('Invalid evidence record tuple')
    }
    const identity = `${tuple.collection}:${tuple.sourceLegacyId}`
    if (identities.has(identity)) throw new Error('Duplicate evidence record tuple')
    identities.add(identity)
    tupleCounts.set(tuple.collection, tupleCounts.get(tuple.collection) + 1)
  }
  if (canonicalRoutes.some((route) => tupleCounts.get(route.collection) !== route.recordCount)) {
    throw new Error('Evidence route record count does not match record tuples')
  }
  return sha256(canonicalJson({
    version,
    sourceSnapshotId,
    sourceAggregateFingerprint,
    routes: canonicalRoutes,
    sourceRoutes: canonicalSourceRoutes,
    recordTuples
  }))
}

const sanitizeExportSnapshot = (snapshot) => {
  if (!snapshot?.manifest || typeof snapshot.getRecords !== 'function') {
    throw new TypeError('A validated export snapshot is required')
  }
  assertValidatedExportSnapshot(snapshot)
  const verifiedManifest = createExportManifest({
    artifacts: snapshot.manifest.artifacts,
    routes: snapshot.manifest.routes,
    prelude: snapshot.manifest.prelude,
    declaredCollections: DECLARED_COLLECTIONS
  })
  if (canonicalJson(verifiedManifest) !== canonicalJson(snapshot.manifest)) {
    throw new Error('Reader manifest authority mismatch')
  }

  const evidenceJsonByCollection = new Map()
  const operationalBsonByCollection = new Map()
  const routeEvidence = []
  const recordTuples = []

  for (const collection of DECLARED_COLLECTIONS) {
    const records = snapshot.getRecords(collection)
    if (!Array.isArray(records)) throw new Error(`Reader records must be an array for ${collection}`)
    const sourceRoute = snapshot.manifest.routes?.find((route) => route.collection === collection)
    const reconstructedFrames = records.map((record) => {
      const bytes = BSON.serialize(record.document)
      const legacyId = record.document?._id instanceof ObjectId ? record.document._id.toHexString() : null
      if (legacyId !== record.legacyId || sha256(bytes) !== record.sourceHash) {
        throw new Error(`Reader record authority mismatch for ${collection}`)
      }
      return bytes
    })
    if (!sourceRoute || sourceRoute.documentCount !== records.length ||
        (sourceRoute.state === 'PRESENT' && sha256(Buffer.concat(reconstructedFrames)) !== sourceRoute.bsonSha256) ||
        (sourceRoute.state === 'ABSENT' && records.length !== 0)) {
      throw new Error(`Reader route authority mismatch for ${collection}`)
    }
    const evidenceJson = []
    const operationalBson = []
    let redactionCount = 0

    for (const record of records) {
      const operationalDocument = createOperationalValue(record.document)
      const operationalBytes = BSON.serialize(operationalDocument)
      const operationalDocumentHash = sha256(operationalBytes)
      operationalBson.push(Buffer.from(operationalBytes))
      const redactions = []
      const sanitizedDocument = sanitizeValue({
        value: record.document,
        collection,
        legacyId: record.legacyId,
        redactions
      })
      assertEvidenceSafe(sanitizedDocument, { collection })
      const sanitizedDocumentHash = sha256(canonicalJson(sanitizedDocument))
      assertRedactionManifestSafe(redactions)
      const redactionManifestHash = sha256(canonicalJson(redactions))
      const evidenceRecord = {
        sourceCollection: collection,
        sourceLegacyId: record.legacyId,
        sourceHash: record.sourceHash,
        sanitizedDocument,
        sanitizedDocumentHash,
        policyVersion: SANITIZER_POLICY_VERSION,
        redactions,
        redactionManifestHash,
        operationalDocumentHash
      }
      evidenceJson.push(canonicalJson(evidenceRecord))
      recordTuples.push({
        collection,
        sourceLegacyId: record.legacyId,
        sourceHash: record.sourceHash,
        sanitizedDocumentHash,
        policyVersion: SANITIZER_POLICY_VERSION,
        redactionManifestHash,
        operationalDocumentHash
      })
      redactionCount += redactions.length
    }

    evidenceJsonByCollection.set(collection, Object.freeze(evidenceJson))
    operationalBsonByCollection.set(collection, Object.freeze(operationalBson))
    routeEvidence.push({ collection, recordCount: records.length, redactionCount })
  }

  const sourceRoutes = DECLARED_COLLECTIONS.map((collection) => {
    const route = snapshot.manifest.routes.find((candidate) => candidate.collection === collection)
    return { collection, state: route.state, documentCount: route.documentCount }
  })
  const fingerprintInput = {
    version: SANITIZER_POLICY_VERSION,
    sourceSnapshotId: snapshot.manifest.snapshotId,
    sourceAggregateFingerprint: snapshot.manifest.aggregateFingerprint,
    routes: routeEvidence,
    sourceRoutes,
    recordTuples
  }
  const evidenceManifest = cloneFrozenJson({
    ...fingerprintInput,
    routes: routeEvidence,
    sourceRoutes,
    evidenceFingerprint: computeEvidenceFingerprint(fingerprintInput)
  })

  const getEvidenceRecords = (collection) => {
    if (!evidenceJsonByCollection.has(collection)) throw new Error(`Unknown declared collection: ${collection}`)
    return Object.freeze(evidenceJsonByCollection.get(collection).map((json) => cloneFrozenJson(JSON.parse(json))))
  }
  const getOperationalRecords = (collection) => {
    if (!operationalBsonByCollection.has(collection)) throw new Error(`Unknown declared collection: ${collection}`)
    return Object.freeze(operationalBsonByCollection.get(collection).map((bytes) => createOperationalValue(BSON.deserialize(Buffer.from(bytes), {
      promoteLongs: false,
      promoteValues: false,
      promoteBuffers: false,
      validation: { utf8: true }
    }))))
  }

  const sanitizedSnapshot = Object.freeze({ evidenceManifest, getEvidenceRecords, getOperationalRecords })
  operationalSanitizedSnapshots.add(sanitizedSnapshot)
  return sanitizedSnapshot
}

const materializeSanitizedEvidence = (sanitized, { includeOperational = false } = {}) => {
  if (!sanitized?.evidenceManifest || typeof sanitized.getEvidenceRecords !== 'function') {
    throw new TypeError('Sanitized evidence boundary is required')
  }
  if (includeOperational && typeof sanitized.getOperationalRecords !== 'function') {
    throw new TypeError('Sanitized operational boundary is required')
  }
  if (includeOperational && !operationalSanitizedSnapshots.has(sanitized)) {
    throw new TypeError('A sanitizer-issued operational snapshot is required')
  }
  const manifest = cloneFrozenJson(sanitized.evidenceManifest)
  validateSourceRoutes(manifest.sourceRoutes)
  const recomputedTuples = []
  const routeStats = new Map()
  const evidenceByCollection = new Map()
  const operationalByCollection = new Map()
  for (const collection of DECLARED_COLLECTIONS) {
    let recordCount = 0
    let redactionCount = 0
    const exposedEvidenceRecords = sanitized.getEvidenceRecords(collection)
    if (!Array.isArray(exposedEvidenceRecords)) throw new Error(`Evidence accessor must return an array for ${collection}`)
    const evidenceRecords = Object.freeze(exposedEvidenceRecords.map(cloneFrozenJson))
    evidenceByCollection.set(collection, evidenceRecords)
    for (const record of evidenceRecords) {
      assertEvidenceSafe(record.sanitizedDocument, { collection })
      const sanitizedDocumentHash = sha256(canonicalJson(record.sanitizedDocument))
      assertRedactionManifestSafe(record.redactions)
      const redactionManifestHash = sha256(canonicalJson(record.redactions))
      if (record.sourceCollection !== collection || record.policyVersion !== SANITIZER_POLICY_VERSION ||
          sanitizedDocumentHash !== record.sanitizedDocumentHash || redactionManifestHash !== record.redactionManifestHash) {
        throw new Error(`Sanitized evidence record verification failed for ${collection}`)
      }
      recomputedTuples.push({
        collection,
        sourceLegacyId: record.sourceLegacyId,
        sourceHash: record.sourceHash,
        sanitizedDocumentHash,
        policyVersion: record.policyVersion,
        redactionManifestHash,
        operationalDocumentHash: record.operationalDocumentHash
      })
      recordCount += 1
      redactionCount += record.redactions.length
    }
    routeStats.set(collection, { recordCount, redactionCount })
    if (includeOperational) {
      const exposedOperationalRecords = sanitized.getOperationalRecords(collection)
      if (!Array.isArray(exposedOperationalRecords)) throw new Error(`Operational accessor must return an array for ${collection}`)
      const operationalRecords = Object.freeze(exposedOperationalRecords.map((document) => createOperationalValue(BSON.deserialize(Buffer.from(BSON.serialize(document)), {
        promoteLongs: false,
        promoteValues: false,
        promoteBuffers: false,
        validation: { utf8: true }
      }))))
      operationalByCollection.set(collection, operationalRecords)
    }
  }
  const canonicalRoutes = validateRouteSummaries(manifest.routes)
  if (canonicalRoutes.some((route) => canonicalJson(routeStats.get(route.collection)) !==
      canonicalJson({ recordCount: route.recordCount, redactionCount: route.redactionCount }))) {
    throw new Error('Evidence route summary verification failed')
  }
  if (canonicalJson(recomputedTuples) !== canonicalJson(manifest.recordTuples)) {
    throw new Error('Evidence record tuple manifest mismatch')
  }
  const recomputed = computeEvidenceFingerprint({
    version: manifest.version,
    sourceSnapshotId: manifest.sourceSnapshotId,
    sourceAggregateFingerprint: manifest.sourceAggregateFingerprint,
    routes: canonicalRoutes,
    sourceRoutes: manifest.sourceRoutes,
    recordTuples: recomputedTuples
  })
  if (recomputed !== manifest.evidenceFingerprint) throw new Error('Evidence fingerprint verification failed')
  if (includeOperational) {
    for (const [index, collection] of DECLARED_COLLECTIONS.entries()) {
      const route = manifest.sourceRoutes[index]
      const operationalRecords = operationalByCollection.get(collection)
      const tuples = manifest.recordTuples.filter((tuple) => tuple.collection === collection)
      if (route.collection !== collection || route.documentCount !== tuples.length || tuples.length !== operationalRecords.length) {
        throw new Error(`Operational boundary count mismatch for ${collection}`)
      }
      const expected = new Map(tuples.map((tuple) => [tuple.sourceLegacyId, tuple.operationalDocumentHash]))
      const seen = new Set()
      for (const document of operationalRecords) {
        const legacyId = document?._id instanceof ObjectId ? document._id.toHexString() : null
        const operationalHash = sha256(BSON.serialize(document))
        if (!legacyId || seen.has(legacyId) || expected.get(legacyId) !== operationalHash) {
          throw new Error(`Operational boundary hash mismatch for ${collection}`)
        }
        seen.add(legacyId)
      }
      if (seen.size !== expected.size) throw new Error(`Operational boundary identity mismatch for ${collection}`)
    }
  }
  return Object.freeze({ manifest, evidenceByCollection, operationalByCollection })
}

const verifySanitizedEvidence = (sanitized) => {
  materializeSanitizedEvidence(sanitized)
  return true
}

module.exports = {
  BCRYPT_PATTERN,
  SANITIZER_POLICY_VERSION,
  assertEvidenceSafe,
  assertRedactionManifestSafe,
  computeEvidenceFingerprint,
  materializeSanitizedEvidence,
  sanitizeExportSnapshot,
  verifySanitizedEvidence
}
