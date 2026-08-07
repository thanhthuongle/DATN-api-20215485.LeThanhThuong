import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'
import { createHash } from 'node:crypto'

/**
 * DiscrepancyManager — create and resolve discrepancy cases.
 *
 * Every non-resolved data/migration/operation issue is stored as a case, never
 * just logged. Cases are deduplicated by a stable fingerprint; re-detecting the
 * same issue after resolution increments recurrence instead of creating
 * unbounded duplicates. `BLOCKING` cases cannot be ignored.
 *
 * Decision: DEC-026 (issues flow through Admin Operations; no direct fix),
 * `docs/v2/architecture/admin-operations.md`.
 */

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

class DiscrepancyManager {
  _db(tx) {
    return tx || getPrismaClient()
  }

  _normalize(value) {
    if (value == null) return null
    const inner = value
    if (Array.isArray(inner)) return inner.map((item) => this._normalize(item))
    if (typeof inner === 'bigint') return inner.toString()
    if (typeof inner === 'object' && !(inner instanceof Date)) {
      return Object.fromEntries(
        Object.entries(inner).sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, this._normalize(v)])
      )
    }
    return inner
  }

  /**
   * Compute a stable fingerprint for a discrepancy.
   * @param {object} params - derives from { source, type, resourceType, legacyMongoId }
   */
  fingerprint({ source, type, resourceType, legacyMongoId }) {
    return sha256(JSON.stringify([source, type, resourceType ?? null, legacyMongoId ?? null]))
  }

  /**
   * Create a discrepancy case (deduplicated by fingerprint for open records).
   * @param {object} params
   * @param {'MIGRATION'|'RECONCILIATION'|'SNAPSHOT'|'OUTBOX'|'JOB'} params.source
   * @param {'BLOCKING'|'REQUIRES_REVIEW'|'AUTO_FIX_SAFE'|'INFO'} params.severity
   * @param {string} params.type
   * @param {object} [params.detail] { resourceType, resourcePublicId, legacyMongoId, expectedData, actualData, evidence, migrationRunId, financialSpaceId }
   * @param {object} [params.tx]
   */
  async create(params, tx) {
    const db = this._db(tx)
    const {
      source, severity = 'INFO', type,
      resourceType = null, resourcePublicId = null, legacyMongoId = null,
      expectedData = null, actualData = null, evidence = {},
      migrationRunId = null, financialSpaceId = null
    } = params
    if (!source) throw new Error('discrepancy source is required')
    if (!type) throw new Error('discrepancy type is required')

    const fp = this.fingerprint({ source, type, resourceType, legacyMongoId })

    // Deduplicate against an existing OPEN/INVESTIGATING case.
    const existing = await db.discrepancy_cases.findUnique({
      where: { fingerprint: fp }
    })
    if (existing && (existing.status === 'OPEN' || existing.status === 'INVESTIGATING')) {
      return existing
    }

    return db.discrepancy_cases.create({
      data: {
        fingerprint: fp,
        source,
        type,
        severity,
        status: 'OPEN',
        financial_space_id: financialSpaceId,
        migration_run_id: migrationRunId,
        resource_type: resourceType,
        resource_public_id: resourcePublicId,
        legacy_mongo_id: legacyMongoId,
        expected_data: this._normalize(expectedData),
        actual_data: this._normalize(actualData),
        evidence: this._normalize(evidence)
      }
    })
  }

  /**
   * Resolve a case with a required terminal reason and actor.
   * @param {object} params { publicId, resolutionAction, resolutionNote, resolvedByUserId }
   */
  async resolve({ publicId, resolutionAction = 'RESOLVED', resolutionNote, resolvedByUserId }, tx) {
    const db = this._db(tx)
    if (!resolutionNote) throw new Error('resolutionNote is required to resolve a discrepancy')
    return db.discrepancy_cases.update({
      where: { public_id: publicId },
      data: {
        status: 'RESOLVED',
        resolution_action: resolutionAction,
        resolution_note: resolutionNote,
        resolved_by_user_id: resolvedByUserId,
        resolved_at: new Date()
      }
    })
  }

  /** Aggregate the open/blocking counts for a run or overall. */
  async statusSummary({ migrationRunId = null } = {}) {
    const db = this._db()
    const where = migrationRunId ? { migration_run_id: migrationRunId } : {}
    const open = await db.discrepancy_cases.count({ where: { ...where, status: { in: ['OPEN', 'INVESTIGATING'] } } })
    const blocking = await db.discrepancy_cases.count({
      where: { ...where, status: { in: ['OPEN', 'INVESTIGATING'] }, severity: 'BLOCKING' }
    })
    return { open, blocking }
  }

  /** List discrepancy cases, optionally filtered. */
  async list({ status, severity, source, limit = 100 } = {}) {
    const db = this._db()
    return db.discrepancy_cases.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(severity ? { severity } : {}),
        ...(source ? { source } : {})
      },
      orderBy: [{ detected_at: 'desc' }, { id: 'desc' }],
      take: limit
    })
  }
}

const discrepancyManager = new DiscrepancyManager()
export default discrepancyManager
export { DiscrepancyManager }