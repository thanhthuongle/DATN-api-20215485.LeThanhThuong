import { describe, expect, it } from 'vitest'
import { evaluateCutoverPrerequisites } from '~/v2/infrastructure/cutover/cutoverPrerequisites'

describe('cutoverPrerequisites.evaluateCutoverPrerequisites', () => {
  const goState = {
    unclassifiedErrors: 0,
    blockingDiscrepancies: 0,
    unbalancedTransactions: 0,
    balanceMismatches: 0,
    migrationApplied: true,
    routeSmokePassed: true,
    deploymentEnv: 'production'
  }

  it('returns GO when every reconciliation gate is clean', () => {
    const res = evaluateCutoverPrerequisites(goState)
    expect(res.verdict).toBe('GO')
    expect(res.pass).toBe(true)
    expect(res.gates).toHaveLength(7)
  })

  it('returns NO_GO and lists gates when any blocking count is non-zero', () => {
    const res = evaluateCutoverPrerequisites({ ...goState, blockingDiscrepancies: 2 })
    expect(res.verdict).toBe('NO_GO')
    expect(res.failingGates).toContain('blocking_discrepancies_zero')
    expect(res.failingGates).not.toContain('balance_mismatches_zero')
  })

  it('defaults to NO_GO with dev environment and no evidence', () => {
    const res = evaluateCutoverPrerequisites()
    expect(res.verdict).toBe('NO_GO')
    expect(res.failingGates).toContain('deployment_env_is_production')
    expect(res.failingGates).toContain('migration_applied')
  })

  it('flags every non-zero reconciliation counter independently', () => {
    const res = evaluateCutoverPrerequisites({ ...goState, unclassifiedErrors: 1, unbalancedTransactions: 3, balanceMismatches: 1 })
    expect(res.verdict).toBe('NO_GO')
    expect(res.failingGates).toEqual(
      expect.arrayContaining(['unclassified_errors_zero', 'unbalanced_transactions_zero', 'balance_mismatches_zero'])
    )
  })

  it('requires critical-flow smoke to pass', () => {
    const res = evaluateCutoverPrerequisites({ ...goState, routeSmokePassed: false })
    expect(res.verdict).toBe('NO_GO')
    expect(res.failingGates).toContain('critical_flow_smoke_passed')
  })
})
