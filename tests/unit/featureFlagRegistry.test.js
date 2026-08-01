import { describe, expect, it } from 'vitest'
import {
  createFeatureFlagRegistry,
  featureFlagDefinitions,
  parseFeatureFlagOverrides
} from '~/v2/infrastructure/feature-flags/featureFlagRegistry'

describe('V2 feature flag registry', () => {
  it('defaults every write flag to disabled', () => {
    const registry = createFeatureFlagRegistry()
    const writeFlags = Object.entries(featureFlagDefinitions)
      .filter(([, definition]) => definition.type === 'write')

    expect(writeFlags).toHaveLength(6)
    writeFlags.forEach(([flagName]) => expect(registry.isEnabled(flagName)).toBe(false))
  })

  it('fails closed for V1 authority and disabled dependencies', () => {
    const wrongAuthority = createFeatureFlagRegistry({
      overrides: { 'v2.accounts.write': true },
      activeFinancialWriteVersion: 'V1'
    })
    expect(wrongAuthority.explain('v2.accounts.write').blockedReason)
      .toBe('ACTIVE_FINANCIAL_WRITE_VERSION_IS_NOT_V2')

    const missingDependency = createFeatureFlagRegistry({
      overrides: { 'v2.transactions.write': true },
      activeFinancialWriteVersion: 'V2'
    })
    expect(missingDependency.explain('v2.transactions.write').blockedReason)
      .toBe('DEPENDENCY_DISABLED')
  })

  it('rejects malformed or unknown overrides', () => {
    expect(() => parseFeatureFlagOverrides('{invalid')).toThrow(/valid JSON/)
    expect(() => parseFeatureFlagOverrides('{"v2.unknown":true}')).toThrow(/Unknown/)
  })
})
