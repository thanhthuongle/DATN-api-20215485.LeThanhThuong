const toRunResponse = (run) => ({
  id: run.public_id,
  runType: run.run_type,
  sourceSnapshotId: run.source_snapshot_id,
  sourceChecksum: run.source_checksum,
  mappingVersion: run.mapping_version,
  schemaVersion: run.schema_version,
  status: run.status,
  sourceCount: run.source_count ? run.source_count.toString() : '0',
  loadedCount: run.loaded_count ? run.loaded_count.toString() : '0',
  rejectedCount: run.rejected_count ? run.rejected_count.toString() : '0',
  startedAt: run.started_at,
  completedAt: run.completed_at,
  summary: run.summary
})

export const toMigrationRunListResponse = (rows) => rows.map(toRunResponse)

export const toMigrationRunResponse = ({ run, discrepancySummary, reconciliation }) => ({
  run: toRunResponse(run),
  discrepancySummary,
  reconciliation
})

const toDiscrepancyResponse = (item) => ({
  id: item.public_id,
  source: item.source,
  type: item.type,
  severity: item.severity,
  status: item.status,
  resourceType: item.resource_type,
  resourcePublicId: item.resource_public_id,
  legacyMongoId: item.legacy_mongo_id,
  evidence: item.evidence,
  detectedAt: item.detected_at,
  resolutionNote: item.resolution_note,
  resolvedAt: item.resolved_at
})

export const toDiscrepancyListResponse = (rows) => rows.map(toDiscrepancyResponse)
export { toDiscrepancyResponse }