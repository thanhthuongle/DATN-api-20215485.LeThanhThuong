#!/usr/bin/env node

const path = require('node:path')
const {
  inspectExportDirectory,
  OBSERVED_ABSENT_COLLECTIONS
} = require('./lib/wave2-export-reader.cjs')
const { sanitizeExportSnapshot } = require('./lib/wave2-export-sanitizer.cjs')
const { buildWave2TransformPlan } = require('./lib/wave2-export-transform.cjs')

const DEFAULT_EXPORT = 'D:\\Sghb\\mongodb-heymoney-data\\Heymoney-Data'
const EXPECTED_SOURCE_AGGREGATE = 'a7bbcdf03dc93eef67597e4c503efaa2b0a4fb91fc62f10b7dd727f0f01a0769'
const EXPECTED_EVIDENCE = 'd1b25339902b9d3f032d6b527e9a3a5ea306e9bd1b80fbb781f3ab7e8a9adc41'
const EXPECTED_PLAN = '054d208dc86819b67551841322ea80b906518d65a81b9ce934ffef7ff06b91fd'

const materialize = (directory) => {
  const source = inspectExportDirectory({
    directory,
    absentCollections: OBSERVED_ABSENT_COLLECTIONS,
    expectedAggregateFingerprint: EXPECTED_SOURCE_AGGREGATE
  })
  const sanitized = sanitizeExportSnapshot(source)
  const plan = buildWave2TransformPlan(sanitized)
  const summary = plan.summary
  const notificationTargetCount = plan.canonicalPlan.notificationTargets.length
  const notificationRecipientTargetCount = plan.canonicalPlan.notificationRecipientTargets.length
  if (sanitized.evidenceManifest.sourceSnapshotId !== `sha256:${EXPECTED_SOURCE_AGGREGATE}` ||
      sanitized.evidenceManifest.evidenceFingerprint !== EXPECTED_EVIDENCE || plan.canonicalPlan.planHash !== EXPECTED_PLAN) {
    throw new Error('Wave 2 export materialization is not the retained authorized snapshot')
  }
  if (summary.sourceCount !== 763 || summary.loadedCount !== 756 || summary.archivedCount !== 7 ||
      summary.rejectedCount !== 0 || summary.blockingCount !== 0 || summary.unclassifiedCount !== 0 ||
      summary.postingCount !== 128 || summary.postingEntryCount !== 256 ||
      summary.balanceHolderCount !== 6 || summary.balanceMismatchCount !== 0 ||
      notificationTargetCount !== 134 || notificationRecipientTargetCount !== 134) {
    throw new Error('Wave 2 export materialization acceptance metrics failed')
  }
  return Object.freeze({
    sourceSnapshotId: sanitized.evidenceManifest.sourceSnapshotId,
    evidenceFingerprint: sanitized.evidenceManifest.evidenceFingerprint,
    planHash: plan.canonicalPlan.planHash,
    summary: {
      sourceCount: summary.sourceCount,
      loadedCount: summary.loadedCount,
      archivedCount: summary.archivedCount,
      rejectedCount: summary.rejectedCount,
      blockingCount: summary.blockingCount,
      unclassifiedCount: summary.unclassifiedCount,
      postingCount: summary.postingCount,
      postingEntryCount: summary.postingEntryCount,
      balanceHolderCount: summary.balanceHolderCount,
      balanceMismatchCount: summary.balanceMismatchCount,
      notificationTargetCount,
      notificationRecipientTargetCount
    }
  })
}

const main = () => {
  const directory = path.resolve(process.argv[2] || DEFAULT_EXPORT)
  const first = materialize(directory)
  const second = materialize(directory)
  if (first.evidenceFingerprint !== second.evidenceFingerprint || first.planHash !== second.planHash ||
      JSON.stringify(first.summary) !== JSON.stringify(second.summary)) {
    throw new Error('Wave 2 export materialization is not deterministic')
  }
  process.stdout.write(`${JSON.stringify({ directory: '<external-export>', runs: 2, ...first }, null, 2)}\n`)
}

main()
