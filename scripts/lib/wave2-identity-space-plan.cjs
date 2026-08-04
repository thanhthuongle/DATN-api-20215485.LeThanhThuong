const { canonicalJson, deepFreeze, sha256 } = require('./wave2-export-manifest.cjs')

const PLAN_VERSION = 'wave2-identity-space-plan-v1'
const OWNED_COLLECTIONS = Object.freeze(['categories', 'accounts', 'accumulations', 'contacts'])

const legacyIdOf = (value) => {
  if (typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value)) return value.toLowerCase()
  if (value && typeof value.toHexString === 'function') {
    const legacyId = value.toHexString()
    if (/^[0-9a-f]{24}$/i.test(legacyId)) return legacyId.toLowerCase()
  }
  return null
}

const blocking = (collection, legacyId, reason) => {
  const error = new Error(`BLOCKING_OWNER_RESOLUTION ${collection}:${legacyId || '<missing-id>'} ${reason}`)
  error.code = 'BLOCKING_OWNER_RESOLUTION'
  error.collection = collection
  error.legacyId = legacyId || null
  error.reason = reason
  return error
}

const assertPlanBoundary = (sanitizedSnapshot, transformPlan) => {
  if (!sanitizedSnapshot?.evidenceManifest?.sourceSnapshotId ||
      !sanitizedSnapshot.evidenceManifest.evidenceFingerprint) {
    throw new TypeError('A sanitized export evidence manifest is required')
  }
  if (!transformPlan?.summary || !transformPlan?.canonicalPlan?.planHash ||
      typeof transformPlan.getOperationalTargetPlan !== 'function') {
    throw new TypeError('A Wave 2 transform plan is required')
  }
  if (transformPlan.summary.blockingCount !== 0 || transformPlan.summary.unclassifiedCount !== 0) {
    throw blocking('transform', null, 'upstream plan contains blocking or unclassified findings')
  }
}

const buildWave2IdentitySpacePlan = ({ sanitizedSnapshot, transformPlan }) => {
  assertPlanBoundary(sanitizedSnapshot, transformPlan)
  const operational = transformPlan.getOperationalTargetPlan()
  const loaded = (collection) => operational.getLoadedDocuments(collection)
  if (loaded('families').length !== 0) {
    throw blocking('families', null, 'family ownership is outside the personal-space slice')
  }

  const users = loaded('users').map((document) => {
    const legacyId = legacyIdOf(document?._id)
    if (!legacyId) throw blocking('users', legacyId, 'missing or invalid user identity')
    return { legacyId, targetKey: `user:${legacyId}` }
  }).sort((left, right) => left.legacyId.localeCompare(right.legacyId))
  if (new Set(users.map((user) => user.legacyId)).size !== users.length) {
    throw blocking('users', null, 'duplicate user identity')
  }

  const userIds = new Set(users.map((user) => user.legacyId))
  const spaces = users.map(({ legacyId }) => ({
    kind: 'PERSONAL', ownerUserKey: `user:${legacyId}`, sourceOwnerKey: `individual:${legacyId}`,
    targetKey: `personal-space:${legacyId}`
  }))
  const memberships = users.map(({ legacyId }) => ({
    role: 'OWNER', status: 'ACTIVE', userKey: `user:${legacyId}`,
    spaceKey: `personal-space:${legacyId}`, targetKey: `personal-owner-membership:${legacyId}`
  }))

  const ownedTargets = []
  for (const collection of OWNED_COLLECTIONS) {
    for (const document of loaded(collection)) {
      const legacyId = legacyIdOf(document?._id)
      const ownerId = legacyIdOf(document?.ownerId)
      if (!legacyId) throw blocking(collection, legacyId, 'missing or invalid source identity')
      if (document?.ownerType !== 'individual') {
        throw blocking(collection, legacyId, `unsupported ownerType ${String(document?.ownerType)}`)
      }
      if (!ownerId || !userIds.has(ownerId)) {
        throw blocking(collection, legacyId, `missing user owner ${ownerId || '<missing>'}`)
      }
      ownedTargets.push({ collection, legacyId, ownerLegacyId: ownerId, spaceKey: `personal-space:${ownerId}` })
    }
  }
  ownedTargets.sort((left, right) => `${left.collection}:${left.legacyId}`.localeCompare(`${right.collection}:${right.legacyId}`))

  const banks = loaded('banks').map((document) => {
    const legacyId = legacyIdOf(document?._id)
    if (!legacyId) throw blocking('banks', legacyId, 'missing or invalid bank identity')
    return { legacyId, targetKey: `bank:${legacyId}` }
  }).sort((left, right) => left.legacyId.localeCompare(right.legacyId))

  const payload = {
    version: PLAN_VERSION,
    sourceSnapshotId: sanitizedSnapshot.evidenceManifest.sourceSnapshotId,
    evidenceFingerprint: sanitizedSnapshot.evidenceManifest.evidenceFingerprint,
    transformPlanHash: transformPlan.canonicalPlan.planHash,
    users,
    spaces,
    memberships,
    banks,
    ownedTargets
  }
  const planHash = sha256(canonicalJson(payload))
  return deepFreeze({
    ...payload,
    counts: {
      users: users.length,
      personalSpaces: spaces.length,
      ownerMemberships: memberships.length,
      banks: banks.length,
      categories: ownedTargets.filter((target) => target.collection === 'categories').length,
      accounts: ownedTargets.filter((target) => target.collection === 'accounts').length,
      accumulations: ownedTargets.filter((target) => target.collection === 'accumulations').length,
      contacts: ownedTargets.filter((target) => target.collection === 'contacts').length
    },
    planHash
  })
}

module.exports = {
  OWNED_COLLECTIONS,
  PLAN_VERSION,
  buildWave2IdentitySpacePlan,
  legacyIdOf
}
