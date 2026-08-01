export const createFeatureFlagAuditEvent = ({
  flagName,
  before,
  after,
  actor,
  reason,
  sourceVersion,
  timestamp = new Date().toISOString()
}) => {
  if (!flagName || !actor || !reason || !sourceVersion) {
    throw new Error('Feature flag audit requires flag, actor, reason and source version')
  }
  if (typeof before !== 'boolean' || typeof after !== 'boolean') {
    throw new Error('Feature flag audit before/after values must be boolean')
  }

  return Object.freeze({
    event: 'v2.feature_flag.changed',
    flagName,
    before,
    after,
    actor,
    reason,
    sourceVersion,
    timestamp
  })
}
