import { describe, expect, it } from 'vitest'
import { resolveWriteAuthority, canOpenV2Writes, WRITE_VERSIONS } from '~/v2/infrastructure/cutover/writeAuthority'

describe('writeAuthority.resolveWriteAuthority', () => {
  it('defaults to V1 and non-writable V2', () => {
    const res = resolveWriteAuthority()
    expect(res.activeVersion).toBe('V1')
    expect(res.isV1Writable).toBe(true)
    expect(res.isV2Writable).toBe(false)
  })

  it('allows V2 write authority only in production', () => {
    expect(resolveWriteAuthority({ activeFinancialWriteVersion: 'V2', deploymentEnv: 'production' }).isV2Writable).toBe(true)
    // Non-production must NOT be allowed to hold V2 write authority.
    expect(resolveWriteAuthority({ activeFinancialWriteVersion: 'V2', deploymentEnv: 'staging' }).isV2Writable).toBe(false)
    expect(resolveWriteAuthority({ activeFinancialWriteVersion: 'V2', deploymentEnv: 'development' }).isV2Writable).toBe(false)
  })

  it('rejects an invalid write version', () => {
    expect(() => resolveWriteAuthority({ activeFinancialWriteVersion: 'V3' })).toThrow(/must be V1 or V2/i)
  })

  it('exposes only V1 and V2 as known versions', () => {
    expect(WRITE_VERSIONS).toEqual(['V1', 'V2'])
  })
})

describe('writeAuthority.canOpenV2Writes', () => {
  const ready = {
    activeFinancialWriteVersion: 'V1',
    deploymentEnv: 'production',
    migrationApplied: true,
    reconciliationClean: true,
    migrationAnchorApproved: true
  }

  it('permits opening V2 writes when every gate passes', () => {
    const res = canOpenV2Writes(ready)
    expect(res.canOpen).toBe(true)
    expect(res.verdict).toBe('CAN_OPEN_V2_WRITES')
    expect(res.failingGates).toHaveLength(0)
  })

  it('denies when not in production', () => {
    const res = canOpenV2Writes({ ...ready, deploymentEnv: 'staging' })
    expect(res.canOpen).toBe(false)
    expect(res.failingGates).toContain('deployment_env_is_production')
  })

  it('denies when already on V2 (no dual authority / no re-flip)', () => {
    const res = canOpenV2Writes({ ...ready, activeFinancialWriteVersion: 'V2' })
    expect(res.canOpen).toBe(false)
    expect(res.failingGates).toContain('current_version_is_v1')
  })

  it('denies when reconciliation is not clean or migration not applied', () => {
    expect(canOpenV2Writes({ ...ready, reconciliationClean: false }).canOpen).toBe(false)
    expect(canOpenV2Writes({ ...ready, migrationApplied: false }).canOpen).toBe(false)
    expect(canOpenV2Writes({ ...ready, migrationAnchorApproved: false }).canOpen).toBe(false)
  })
})
