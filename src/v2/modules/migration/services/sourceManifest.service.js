import { createHash } from 'node:crypto'
import {
  DECLARED_SOURCE_COLLECTIONS,
  MIGRATION_MAPPING_VERSION
} from '../constants'

/**
 * SourceManifestService — deterministic snapshot manifest for migration.
 *
 * A migration run is identified by `(source_snapshot_id, source_checksum,
 * mapping_version, schema_version, run_type)`. The same source data must
 * always produce the same canonical checksum so that a clean rerun is
 * verifiably deterministic (reconciliation-specification.md "Determinism").
 *
 * SHA-256 digests are computed over canonical JSON (sorted keys), the same
 * scheme used by `scripts/lib/wave2-export-manifest.cjs`.
 */

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    // ObjectId / Date / BigInt degrade to their string/comparable form.
    if (typeof value.toHexString === 'function') return value.toHexString()
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'bigint' || typeof value.valueOf === 'function') {
      const primitives = ['string', 'number', 'boolean']
      const primitive = value.valueOf()
      if (primitive !== value && primitives.includes(typeof primitive)) return primitive
    }
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
    )
  }
  return value
}

const canonicalJson = (value) => JSON.stringify(canonicalize(value))

class SourceManifestService {
  /**
   * Build a deterministic source manifest for the provided collections.
   *
   * @param {object} params
   * @param {Array<{ collection: string, documents: Array<object> }>} params.collections
   * @param {object} [params.mongoInfo] - { serverVersion, toolVersion } metadata
   * @returns {{ snapshotId: string, sourceChecksum: string, collections: Array<object> }}
   */
  build({ collections, mongoInfo = null }) {
    if (!Array.isArray(collections)) throw new Error('collections array is required')

    const routes = []
    for (const item of collections) {
      if (!item || typeof item !== 'object') throw new Error('each collection must be an object')
      const { collection, documents } = item
      if (!DECLARED_SOURCE_COLLECTIONS.includes(collection)) {
        throw new Error(`collection is not a declared source: ${collection}`)
      }
      if (!Array.isArray(documents)) throw new Error(`documents for ${collection} must be an array`)
      const collectionHash = sha256(canonicalJson({ collection, documents }))
      routes.push({
        collection,
        documentCount: documents.length,
        collectionHash
      })
    }

    // Order by declared dependency graph so the manifest is canonical.
    routes.sort((a, b) => {
      const ia = DECLARED_SOURCE_COLLECTIONS.indexOf(a.collection)
      const ib = DECLARED_SOURCE_COLLECTIONS.indexOf(b.collection)
      return ia - ib
    })

    const manifest = {
      mappingVersion: MIGRATION_MAPPING_VERSION,
      mongoInfo: mongoInfo
        ? { serverVersion: mongoInfo.serverVersion ?? null, toolVersion: mongoInfo.toolVersion ?? null }
        : null,
      routes
    }

    const sourceChecksum = sha256(canonicalJson(manifest))
    const snapshotId = `sha256:${sourceChecksum}`

    return {
      snapshotId,
      sourceChecksum,
      collections: routes
    }
  }
}

const sourceManifestService = new SourceManifestService()
export default sourceManifestService
export { SourceManifestService, canonicalJson, canonicalize, sha256 }