import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'
import { createHash } from 'node:crypto'
import sourceManifestService, { canonicalJson, canonicalize, sha256 as manifestSha256 } from './sourceManifest.service'
import migrationRunRepository from '../repositories/migrationRun.repository'
import discrepancyManager from './discrepancyManager.service'
import reconciliationEngine from './reconciliationEngine.service'
import {
  ARCHIVE_ONLY_COLLECTIONS,
  REDACTED_FIELD_PATTERN,
  MIGRATION_MAPPING_VERSION,
  MIGRATION_SANITIZATION_POLICY_VERSION,
  SCHEMA_VERSION
} from '../constants'

// Use the canonicalJson from sourceManifestService for consistency
const sha256 = manifestSha256

/** Convert a Mongo _id to a lowercase 24-char hex string. */
const legacyIdOf = (value) => {
  if (typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value)) return value.toLowerCase()
  if (value && typeof value.toHexString === 'function') return value.toHexString().toLowerCase()
  return null
}

/**
 * MigrationEngine — orchestrates stage -> (transform hook) -> checkpoint by
 * graph level, then runs reconciliation and writes discrepancy cases.
 *
 * The transform/load step is intentionally a dependency-injected hook so the
 * engine stays testable and the actual entity mapping stays in dedicated
 * transformers (composed by the caller for a rehearsal). Staging is immutable
 * evidence; a rerun of the same source on a clean database produces the same
 * checksums (determinism requirement).
 */
class MigrationEngine {
  /**
   * @param {object} [deps] - dependency overrides for tests
   */
  constructor(deps = {}) {
    this.runRepo = deps.runRepo || migrationRunRepository
    this.manifestService = deps.manifestService || sourceManifestService
    this.discrepancy = deps.discrepancy || discrepancyManager
    this.reconciliation = deps.reconciliation || reconciliationEngine
    // Loaders receive { runId, collections, runRepo } and return { loaded, rejected }.
    this.loaders = deps.loaders || []
    this.prisma = deps.prisma || null
  }

  _redactValue(value, path, redactedPaths) {
    if (Array.isArray(value)) {
      return value.map((item, index) => this._redactValue(item, `${path}[${index}]`, redactedPaths))
    }
    if (value && typeof value === 'object' && !(value instanceof Date) &&
        typeof value.toHexString !== 'function') {
      const out = {}
      for (const key of Object.keys(value)) {
        if (REDACTED_FIELD_PATTERN.test(key)) {
          redactedPaths.push(`${path}.${key}`)
          continue
        }
        out[key] = this._redactValue(value[key], `${path}.${key}`, redactedPaths)
      }
      return out
    }
    return value
  }

  /**
   * Sanitize a raw document.
   * @returns {{ sanitized, sourceHash, sanitizedHash, redactionManifest }}
   */
  sanitizeDocument(raw, rawHash) {
    const redactionManifest = []
    const sanitized = this._redactValue(canonicalize(raw), '$', redactionManifest)
    return {
      sanitized,
      sourceHash: rawHash,
      sanitizedHash: sha256(canonicalJson(sanitized)),
      redactionManifest
    }
  }

  /**
   * Graph level lookup for a collection (mirrors load-dependency-graph.md).
   */
  _graphLevel(collection) {
    const leveled = {
      users: 2,
      families: 4,
      banks: 5,
      categories: 5,
      contacts: 5,
      money_sources: 7,
      accounts: 8,
      accumulations: 8,
      savings_accounts: 8,
      budgets: 10,
      transactions: 11,
      expenses: 12,
      incomes: 12,
      transfers: 12,
      contributions: 12,
      loans: 13,
      borrowings: 13,
      collections: 14,
      repayments: 14,
      notifications: 15,
      user_notifications: 15,
      contribution_requests: 17,
      group_payouts: 17,
      invitations: 17,
      proposal_expenses: 17,
      system_tasks: 17
    }
    return leveled[collection] ?? 20
  }

  /**
   * Stage all source records for a run. Idempotent per legacy id.
   * @param {object} params
   * @param {bigint} params.runId
   * @param {Array<{collection: string, documents: Array}>} params.collections
   */
  async stageAll({ runId, collections }) {
    const prisma = getPrismaClient()
    const stats = { staged: 0, loaded: 0, archived: 0, rejected: 0 }

    for (const { collection, documents } of collections) {
      const level = this._graphLevel(collection)
      await this.runRepo.createCheckpoint(runId, level, collection)

      for (const doc of documents) {
        const legacyId = legacyIdOf(doc._id)
        if (!legacyId) {
          await this.runRepo.markSourceRejected(runId, collection, doc._id?.toString?.() ?? 'unknown',
            'INVALID_OR_DUPLICATE_LEGACY_ID')
          stats.rejected += 1
          continue
        }
        const sourceHash = sha256(canonicalJson(doc))
        const { sanitized, sanitizedHash, redactionManifest } = this.sanitizeDocument(doc, sourceHash)

        await prisma.$transaction(async (tx) => {
          const existing = await this.runRepo.findSourceRecord(runId, collection, legacyId, tx)
          if (!existing) {
            await this.runRepo.stageSourceRecord({
              runId, collection, legacyId,
              sourceHash,
              rawDocument: sanitized,
              sanitizedDocumentHash: sanitizedHash,
              sanitizationPolicyVersion: MIGRATION_SANITIZATION_POLICY_VERSION,
              redactionManifest,
              tx
            })
            stats.staged += 1
          }
          if (ARCHIVE_ONLY_COLLECTIONS.has(collection)) {
            const archived = await this.runRepo.markSourceArchived(runId, collection, legacyId, tx)
            if (archived) stats.archived += 1
          } else {
            stats.loaded += 1
          }
        })
      }
    }
    return stats
  }

  /**
   * Run the full migration pipeline for a source snapshot.
   * @param {object} params
   * @param {Array<{collection, documents}>} params.collections
   * @param {(params: {runId, collections, runRepo}) => Promise<void>} [params.transform]
   * @param {'SAMPLE'|'DRY_RUN'|'REHEARSAL'|'FINAL'} [params.runType]
   */
  async runMigration({ collections, transform = null, runType = 'DRY_RUN' }) {
    const manifest = this.manifestService.build({
      collections,
      mongoInfo: { serverVersion: null, toolVersion: 'N/A' }
    })
    const existing = await this.runRepo.findRun({
      sourceSnapshotId: manifest.snapshotId,
      sourceChecksum: manifest.sourceChecksum,
      mappingVersion: MIGRATION_MAPPING_VERSION,
      schemaVersion: SCHEMA_VERSION,
      runType
    })
    if (existing) {
      throw new Error('DRY_RUN_ALREADY_EXISTS: use a clean controlled database')
    }

    const totalSourceCount = collections.reduce((acc, c) => acc + c.documents.length, 0)
    const run = await this.runRepo.createRun({
      runType,
      sourceSnapshotId: manifest.snapshotId,
      sourceChecksum: manifest.sourceChecksum,
      mappingVersion: MIGRATION_MAPPING_VERSION,
      schemaVersion: SCHEMA_VERSION,
      sourceCount: totalSourceCount
    })

    try {
      const stageStats = await this.stageAll({ runId: run.id, collections })
      if (transform) {
        await transform({ runId: run.id, collections, runRepo: this.runRepo })
      }
      for (const loader of this.loaders) {
        await loader.load({ runId: run.id, collections, runRepo: this.runRepo })
      }
      const reconc = await this.reconciliation.run()
      const summary = {
        sourceCount: totalSourceCount,
        ...stageStats,
        reconcPass: reconc.pass,
        gates: reconc.gates
      }
      await this.runRepo.updateRun(run.id, {
        status: reconc.pass ? 'COMPLETED' : 'BLOCKED',
        loadedCount: stageStats.loaded,
        rejectedCount: stageStats.rejected,
        summary,
        completedAt: new Date()
      })
      if (!reconc.pass) {
        await this.discrepancy.create({
          source: 'MIGRATION',
          severity: 'BLOCKING',
          type: 'RECONCILIATION_FAILED',
          evidence: { runId: run.id, gates: reconc.gates },
          migrationRunId: run.id
        })
      }
      return { run, manifest, reconc, summary }
    } catch (error) {
      await this.runRepo.updateRun(run.id, {
        status: 'FAILED',
        completedAt: new Date()
      })
      throw error
    }
  }
}

const migrationEngine = new MigrationEngine()
export default migrationEngine
export { MigrationEngine }

