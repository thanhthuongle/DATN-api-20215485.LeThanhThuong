const { createHash } = require('node:crypto')

const MANIFEST_VERSION = 'wave2-export-manifest-v1'
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const ARTIFACT_NAME_PATTERN = /^(?:[a-z][a-z0-9_]*\.(?:bson|metadata\.json)|prelude\.json)$/
const COLLECTION_NAME_PATTERN = /^[a-z][a-z0-9_]*$/

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
    )
  }
  return value
}

const canonicalJson = (value) => JSON.stringify(canonicalize(value))

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

const cloneCanonical = (value) => JSON.parse(canonicalJson(value))

const assertSafeInteger = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative safe integer`)
}

const assertSha256 = (value, label) => {
  if (!SHA256_PATTERN.test(value || '')) throw new Error(`${label} must be a lowercase SHA-256 digest`)
}

const createExportManifest = ({ artifacts, routes, prelude = null, declaredCollections }) => {
  if (!Array.isArray(artifacts) || !Array.isArray(routes) || !Array.isArray(declaredCollections)) {
    throw new TypeError('artifacts, routes, and declaredCollections arrays are required')
  }
  if (!declaredCollections.length) throw new Error('declaredCollections must not be empty')
  if (prelude !== null) {
    if (!prelude || typeof prelude !== 'object' || Array.isArray(prelude)) {
      throw new Error('Prelude manifest payload must be an object')
    }
    const preludeKeys = Object.keys(prelude).sort()
    if (canonicalJson(preludeKeys) !== canonicalJson(['ServerVersion', 'ToolVersion']) ||
        preludeKeys.some((key) => prelude[key] !== null && typeof prelude[key] !== 'string')) {
      throw new Error('Prelude must contain only ServerVersion and ToolVersion as string or null')
    }
  }

  const declared = new Set()
  for (const collection of declaredCollections) {
    if (!COLLECTION_NAME_PATTERN.test(collection || '') || declared.has(collection)) {
      throw new Error(`Invalid or duplicate declared collection: ${collection}`)
    }
    declared.add(collection)
  }

  const artifactNames = new Set()
  const canonicalArtifacts = artifacts.map(({ name, bytes, sha256: artifactHash }) => {
    if (!ARTIFACT_NAME_PATTERN.test(name || '') || artifactNames.has(name)) {
      throw new Error(`Invalid or duplicate artifact name: ${name}`)
    }
    artifactNames.add(name)
    assertSafeInteger(bytes, `Artifact bytes for ${name}`)
    assertSha256(artifactHash, `Artifact hash for ${name}`)
    return { name, bytes, sha256: artifactHash }
  }).sort((left, right) => left.name.localeCompare(right.name))

  const routeNames = new Set()
  const canonicalRoutes = routes.map((route) => {
    const { collection, state, documentCount } = route
    if (!declared.has(collection) || routeNames.has(collection)) {
      throw new Error(`Unexpected or duplicate manifest route: ${collection}`)
    }
    routeNames.add(collection)
    if (!['PRESENT', 'ABSENT'].includes(state)) throw new Error(`Invalid route state for ${collection}`)
    assertSafeInteger(documentCount, `Document count for ${collection}`)

    if (state === 'ABSENT') {
      if (documentCount !== 0 || route.bsonSha256 || route.metadataSha256 || route.metadata) {
        throw new Error(`Absent route contains live artifact data: ${collection}`)
      }
      if (artifactNames.has(`${collection}.bson`) || artifactNames.has(`${collection}.metadata.json`)) {
        throw new Error(`Absent route has artifacts: ${collection}`)
      }
      return {
        collection,
        state,
        documentCount: 0,
        bsonSha256: null,
        metadataSha256: null,
        metadata: null
      }
    }

    assertSha256(route.bsonSha256, `BSON route hash for ${collection}`)
    assertSha256(route.metadataSha256, `Metadata route hash for ${collection}`)
    if (!route.metadata || typeof route.metadata !== 'object' || Array.isArray(route.metadata)) {
      throw new Error(`Present route metadata is required for ${collection}`)
    }
    const bsonArtifact = canonicalArtifacts.find((artifact) => artifact.name === `${collection}.bson`)
    const metadataArtifact = canonicalArtifacts.find((artifact) => artifact.name === `${collection}.metadata.json`)
    if (!bsonArtifact || !metadataArtifact || bsonArtifact.sha256 !== route.bsonSha256 ||
        metadataArtifact.sha256 !== route.metadataSha256) {
      throw new Error(`Present route artifact completeness mismatch for ${collection}`)
    }
    return {
      collection,
      state,
      documentCount,
      bsonSha256: route.bsonSha256,
      metadataSha256: route.metadataSha256,
      metadata: cloneCanonical(route.metadata)
    }
  }).sort((left, right) => left.collection.localeCompare(right.collection))

  if (routeNames.size !== declared.size || [...declared].some((collection) => !routeNames.has(collection))) {
    throw new Error('Manifest routes do not completely cover declared collections')
  }
  for (const artifact of canonicalArtifacts) {
    if (artifact.name === 'prelude.json') continue
    const collection = artifact.name.replace(/\.(?:bson|metadata\.json)$/, '')
    if (!routeNames.has(collection)) throw new Error(`Artifact has no declared route: ${artifact.name}`)
  }
  if (artifactNames.has('prelude.json') !== (prelude !== null)) {
    throw new Error('Prelude artifact and manifest payload completeness mismatch')
  }

  const fingerprintPayload = {
    version: MANIFEST_VERSION,
    artifacts: canonicalArtifacts,
    routes: canonicalRoutes,
    prelude: prelude === null ? null : cloneCanonical(prelude)
  }
  const aggregateFingerprint = sha256(canonicalJson(fingerprintPayload))

  return deepFreeze({
    ...fingerprintPayload,
    aggregateFingerprint,
    snapshotId: `sha256:${aggregateFingerprint}`
  })
}

module.exports = {
  MANIFEST_VERSION,
  SHA256_PATTERN,
  canonicalJson,
  createExportManifest,
  deepFreeze,
  sha256
}
