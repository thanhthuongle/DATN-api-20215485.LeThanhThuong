import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'

/**
 * MigrationRunRepository — persistence for migration runs, staged source
 * records, and checkpoints. These are governance/evidence tables (DEC-026);
 * they are immutable after staging and can only move STAGED -> LOADED|ARCHIVED|REJECTED.
 *
 * All operations use an explicit transaction client when the caller provides
 * one, or the global client otherwise (these are not financial writes, so the
 * TransactionContext requirement does not apply).
 */

class MigrationRunRepository {
  _db(tx) {
    return tx || getPrismaClient()
  }

  /** Create a migration run. */
  async createRun({
    runType, sourceSnapshotId, sourceChecksum, mappingVersion, schemaVersion, sourceCount, tx
  }) {
    const db = this._db(tx)
    return db.migration_runs.create({
      data: {
        run_type: runType,
        source_snapshot_id: sourceSnapshotId,
        source_checksum: sourceChecksum,
        mapping_version: mappingVersion,
        schema_version: schemaVersion,
        status: 'RUNNING',
        started_at: new Date(),
        source_count: sourceCount
      }
    })
  }

  /** Find a run by its unique identity. */
  async findRun({ sourceSnapshotId, sourceChecksum, mappingVersion, schemaVersion, runType, tx }) {
    const db = this._db(tx)
    return db.migration_runs.findFirst({
      where: {
        source_snapshot_id: sourceSnapshotId,
        source_checksum: sourceChecksum,
        mapping_version: mappingVersion,
        schema_version: schemaVersion,
        run_type: runType
      }
    })
  }

  /** Update a run's status/counters/summary. */
  async updateRun(runId, data, tx) {
    const db = this._db(tx)
    return db.migration_runs.update({
      where: { id: runId },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.loadedCount !== undefined ? { loaded_count: data.loadedCount } : {}),
        ...(data.rejectedCount !== undefined ? { rejected_count: data.rejectedCount } : {}),
        ...(data.summary ? { summary: data.summary } : {}),
        ...(data.completedAt ? { completed_at: data.completedAt } : {})
      }
    })
  }

  /** Check if a staged source record already exists (idempotency by legacy id). */
  async findSourceRecord(runId, collection, legacyId, tx) {
    const db = this._db(tx)
    return db.migration_source_records.findUnique({
      where: {
        migration_run_id_source_collection_source_legacy_id: {
          migration_run_id: runId,
          source_collection: collection,
          source_legacy_id: legacyId
        }
      }
    })
  }

  /** Stage a raw source record (immutable evidence). */
  async stageSourceRecord({
    runId, collection, legacyId, sourceHash, rawDocument, sanitizedDocumentHash,
    sanitizationPolicyVersion, redactionManifest, tx
  }) {
    const db = this._db(tx)
    return db.migration_source_records.create({
      data: {
        migration_run_id: runId,
        source_collection: collection,
        source_legacy_id: legacyId,
        source_hash: sourceHash,
        raw_document: rawDocument,
        sanitized_document_hash: sanitizedDocumentHash,
        sanitization_policy_version: sanitizationPolicyVersion,
        redaction_manifest: redactionManifest
      }
    })
  }

  /** Mark a staged record as loaded with target identity. */
  async markSourceLoaded(runId, collection, legacyId, { targetType, targetPublicId }, tx) {
    const db = this._db(tx)
    return db.migration_source_records.update({
      where: {
        migration_run_id_source_collection_source_legacy_id: {
          migration_run_id: runId,
          source_collection: collection,
          source_legacy_id: legacyId
        }
      },
      data: {
        disposition: 'LOADED',
        target_type: targetType,
        target_public_id: targetPublicId,
        processed_at: new Date()
      }
    })
  }

  /** Mark a staged record as archived (archive-only lane). */
  async markSourceArchived(runId, collection, legacyId, tx) {
    const db = this._db(tx)
    const updated = await db.migration_source_records.update({
      where: {
        migration_run_id_source_collection_source_legacy_id: {
          migration_run_id: runId,
          source_collection: collection,
          source_legacy_id: legacyId
        }
      },
      data: {
        disposition: 'ARCHIVED',
        processed_at: new Date()
      }
    })
    return updated.disposition === 'ARCHIVED'
  }

  /** Mark a staged record as rejected with a classify code. */
  async markSourceRejected(runId, collection, legacyId, rejectCode, tx) {
    const db = this._db(tx)
    return db.migration_source_records.update({
      where: {
        migration_run_id_source_collection_source_legacy_id: {
          migration_run_id: runId,
          source_collection: collection,
          source_legacy_id: legacyId
        }
      },
      data: {
        disposition: 'REJECTED',
        reject_code: rejectCode,
        processed_at: new Date()
      }
    })
  }

  /** Find a checkpoint for a graph level + collection. */
  async findCheckpoint(runId, graphLevel, collection, tx) {
    const db = this._db(tx)
    return db.migration_checkpoints.findUnique({
      where: {
        migration_run_id_graph_level_source_collection: {
          migration_run_id: runId,
          graph_level: graphLevel,
          source_collection: collection
        }
      }
    })
  }

  /** Create a new checkpoint. */
  async createCheckpoint(runId, graphLevel, collection, tx) {
    const db = this._db(tx)
    return db.migration_checkpoints.create({
      data: {
        migration_run_id: runId,
        graph_level: graphLevel,
        source_collection: collection,
        status: 'PENDING'
      }
    })
  }
  /** Start a checkpoint (PENDING -> RUNNING). */
  async startCheckpoint(runId, graphLevel, collection, tx) {
    const db = this._db(tx)
    return db.migration_checkpoints.update({
      where: {
        migration_run_id_graph_level_source_collection: {
          migration_run_id: runId,
          graph_level: graphLevel,
          source_collection: collection
        }
      },
      data: { status: 'RUNNING', started_at: new Date() }
    })
  }

  /** Complete a checkpoint with counters and canonical hash. */
  async completeCheckpoint(runId, graphLevel, collection, {
    processedCount, loadedCount, rejectedCount, canonicalHash, tx
  }) {
    const db = this._db(tx)
    return db.migration_checkpoints.update({
      where: {
        migration_run_id_graph_level_source_collection: {
          migration_run_id: runId,
          graph_level: graphLevel,
          source_collection: collection
        }
      },
      data: {
        status: 'COMPLETED',
        processed_count: processedCount,
        loaded_count: loadedCount,
        rejected_count: rejectedCount,
        ...(canonicalHash ? { canonical_hash: canonicalHash } : {}),
        completed_at: new Date()
      }
    })
  }

  /** Fail a checkpoint. */
  async failCheckpoint(runId, graphLevel, collection, tx) {
    const db = this._db(tx)
    return db.migration_checkpoints.update({
      where: {
        migration_run_id_graph_level_source_collection: {
          migration_run_id: runId,
          graph_level: graphLevel,
          source_collection: collection
        }
      },
      data: { status: 'FAILED', completed_at: new Date() }
    })
  }

  /** List migration runs, newest first. */
  async listRuns({ status, runType, limit = 50 } = {}, tx) {
    const db = this._db(tx)
    return db.migration_runs.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(runType ? { run_type: runType } : {})
      },
      orderBy: [{ id: 'desc' }],
      take: limit
    })
  }

  /** Find a run by internal id. */
  async findRunById(runId, tx) {
    const db = this._db(tx)
    return db.migration_runs.findUnique({ where: { id: runId } })
  }
}

const migrationRunRepository = new MigrationRunRepository()
export default migrationRunRepository
export { MigrationRunRepository }