const FLAG_DEFINITIONS = Object.freeze({
  'v2.accounts.read': { type: 'read', defaultValue: false, dependencies: [] },
  'v2.accounts.write': { type: 'write', defaultValue: false, dependencies: [] },
  'v2.accumulations.write': { type: 'write', defaultValue: false, dependencies: ['v2.accounts.write'] },
  'v2.savings.write': { type: 'write', defaultValue: false, dependencies: ['v2.accounts.write'] },
  'v2.transactions.write': { type: 'write', defaultValue: false, dependencies: ['v2.accounts.write'] },
  'v2.debts.write': { type: 'write', defaultValue: false, dependencies: ['v2.accounts.write'] },
  'v2.budgets.write': { type: 'write', defaultValue: false, dependencies: ['v2.transactions.write'] },
  'v2.admin.enabled': { type: 'admin', defaultValue: false, dependencies: [] },
  'v2.jobs.financial.enabled': { type: 'job', defaultValue: false, dependencies: ['v2.transactions.write'] },
  'v2.jobs.snapshot.enabled': { type: 'job', defaultValue: false, dependencies: [] }
})

const assertKnownOverrides = (overrides) => {
  Object.entries(overrides).forEach(([flagName, value]) => {
    if (!FLAG_DEFINITIONS[flagName]) {
      throw new Error(`Unknown V2 feature flag: ${flagName}`)
    }

    if (typeof value !== 'boolean') {
      throw new Error(`V2 feature flag ${flagName} must be a boolean`)
    }
  })
}

export const parseFeatureFlagOverrides = (rawOverrides) => {
  if (!rawOverrides) return {}

  let overrides
  try {
    overrides = JSON.parse(rawOverrides)
  } catch (error) {
    throw new Error(`V2_FEATURE_FLAGS_JSON must contain valid JSON: ${error.message}`)
  }

  if (!overrides || Array.isArray(overrides) || typeof overrides !== 'object') {
    throw new Error('V2_FEATURE_FLAGS_JSON must contain a JSON object')
  }

  assertKnownOverrides(overrides)
  return overrides
}

export const createFeatureFlagRegistry = ({
  overrides = {},
  activeFinancialWriteVersion = 'V1'
} = {}) => {
  assertKnownOverrides(overrides)

  if (!['V1', 'V2'].includes(activeFinancialWriteVersion)) {
    throw new Error('ACTIVE_FINANCIAL_WRITE_VERSION must be V1 or V2')
  }

  const snapshot = {}

  Object.entries(FLAG_DEFINITIONS).forEach(([flagName, definition]) => {
    const requestedValue = overrides[flagName] ?? definition.defaultValue
    const writeAuthorityBlocked = definition.type === 'write' && activeFinancialWriteVersion !== 'V2'
    const dependencyBlocked = definition.dependencies.some((dependency) => !snapshot[dependency]?.enabled)

    snapshot[flagName] = Object.freeze({
      name: flagName,
      type: definition.type,
      dependencies: Object.freeze([...definition.dependencies]),
      requestedValue,
      enabled: requestedValue && !writeAuthorityBlocked && !dependencyBlocked,
      blockedReason: writeAuthorityBlocked
        ? 'ACTIVE_FINANCIAL_WRITE_VERSION_IS_NOT_V2'
        : dependencyBlocked
          ? 'DEPENDENCY_DISABLED'
          : null
    })
  })

  Object.freeze(snapshot)

  return Object.freeze({
    isEnabled: (flagName) => {
      if (!snapshot[flagName]) throw new Error(`Unknown V2 feature flag: ${flagName}`)
      return snapshot[flagName].enabled
    },
    explain: (flagName) => {
      if (!snapshot[flagName]) throw new Error(`Unknown V2 feature flag: ${flagName}`)
      return snapshot[flagName]
    },
    snapshot: () => snapshot
  })
}

export const featureFlagDefinitions = FLAG_DEFINITIONS
