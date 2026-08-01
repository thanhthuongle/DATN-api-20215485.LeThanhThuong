const assert = require('node:assert/strict')

const {
  createFeatureFlagRegistry,
  featureFlagDefinitions,
  parseFeatureFlagOverrides
} = require('../build/src/v2/infrastructure/feature-flags/featureFlagRegistry')

const writeFlagNames = Object.entries(featureFlagDefinitions)
  .filter(([, definition]) => definition.type === 'write')
  .map(([flagName]) => flagName)

const defaults = createFeatureFlagRegistry()
assert.ok(writeFlagNames.length > 0)
writeFlagNames.forEach((flagName) => assert.equal(defaults.isEnabled(flagName), false))

const blockedByAuthority = createFeatureFlagRegistry({
  overrides: {
    'v2.accounts.write': true,
    'v2.transactions.write': true
  },
  activeFinancialWriteVersion: 'V1'
})
assert.equal(blockedByAuthority.isEnabled('v2.accounts.write'), false)
assert.equal(blockedByAuthority.explain('v2.accounts.write').blockedReason, 'ACTIVE_FINANCIAL_WRITE_VERSION_IS_NOT_V2')

const enabledWithDependencies = createFeatureFlagRegistry({
  overrides: {
    'v2.accounts.write': true,
    'v2.transactions.write': true
  },
  activeFinancialWriteVersion: 'V2'
})
assert.equal(enabledWithDependencies.isEnabled('v2.transactions.write'), true)

const blockedByDependency = createFeatureFlagRegistry({
  overrides: { 'v2.transactions.write': true },
  activeFinancialWriteVersion: 'V2'
})
assert.equal(blockedByDependency.isEnabled('v2.transactions.write'), false)
assert.equal(blockedByDependency.explain('v2.transactions.write').blockedReason, 'DEPENDENCY_DISABLED')

assert.throws(() => parseFeatureFlagOverrides('{invalid'), /valid JSON/)
assert.throws(() => parseFeatureFlagOverrides('{"v2.unknown":true}'), /Unknown V2 feature flag/)
assert.throws(() => createFeatureFlagRegistry({ activeFinancialWriteVersion: 'AUTO' }), /must be V1 or V2/)

process.stdout.write(`Feature flag verification PASS: ${writeFlagNames.length} V2 write flags default off; authority/dependency fail-closed checks passed.\n`)
