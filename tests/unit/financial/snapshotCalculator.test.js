import { describe, expect, it } from 'vitest'
import snapshotCalculator from '~/v2/modules/financial/snapshot/snapshotCalculator'

describe('SnapshotCalculator', () => {
  describe('getUtcDayRange', () => {
    it('returns correct UTC day range', () => {
      const result = snapshotCalculator.getUtcDayRange('2026-01-15')
      expect(result.periodStartUtc.toISOString()).toBe('2026-01-15T00:00:00.000Z')
      expect(result.periodEndUtc.toISOString()).toBe('2026-01-16T00:00:00.000Z')
    })

    it('handles month boundaries', () => {
      const result = snapshotCalculator.getUtcDayRange('2026-01-31')
      expect(result.periodStartUtc.toISOString()).toBe('2026-01-31T00:00:00.000Z')
      expect(result.periodEndUtc.toISOString()).toBe('2026-02-01T00:00:00.000Z')
    })
  })

  describe('calculateFromEntries', () => {
    it('calculates inflow and outflow correctly', () => {
      const entries = [
        { account_sequence: BigInt(1), amount: BigInt(500000) },
        { account_sequence: BigInt(2), amount: BigInt(-200000) },
        { account_sequence: BigInt(3), amount: BigInt(300000) }
      ]
      const result = snapshotCalculator.calculateFromEntries(entries, BigInt(0))

      expect(result.openingBalance).toBe(BigInt(0))
      expect(result.totalInflow).toBe(BigInt(800000))
      expect(result.totalOutflow).toBe(BigInt(200000))
      expect(result.closingBalance).toBe(BigInt(600000))
      expect(result.entryCount).toBe(3)
      expect(result.firstEntrySequence).toBe(BigInt(1))
      expect(result.lastEntrySequence).toBe(BigInt(3))
      expect(result.valid).toBe(true)
    })

    it('uses previousClosingBalance as opening', () => {
      const entries = [
        { account_sequence: BigInt(1), amount: BigInt(100000) }
      ]
      const result = snapshotCalculator.calculateFromEntries(entries, BigInt(500000))

      expect(result.openingBalance).toBe(BigInt(500000))
      expect(result.closingBalance).toBe(BigInt(600000))
      expect(result.valid).toBe(true)
    })

    it('handles empty entries', () => {
      const result = snapshotCalculator.calculateFromEntries([], BigInt(100000))
      expect(result.totalInflow).toBe(BigInt(0))
      expect(result.totalOutflow).toBe(BigInt(0))
      expect(result.closingBalance).toBe(BigInt(100000))
      expect(result.entryCount).toBe(0)
    })

    it('returns null sequences for empty entries', () => {
      const result = snapshotCalculator.calculateFromEntries([], BigInt(0))
      expect(result.firstEntrySequence).toBeNull()
      expect(result.lastEntrySequence).toBeNull()
    })
  })

  describe('computeChecksum', () => {
    it('produces deterministic checksum', () => {
      const params = {
        ledgerAccountId: BigInt(1),
        businessDate: '2026-01-15',
        openingBalance: BigInt(0),
        totalInflow: BigInt(500000),
        totalOutflow: BigInt(200000),
        closingBalance: BigInt(300000),
        lastEntrySequence: BigInt(5),
        entryCount: 3,
        calculationVersion: 1
      }

      const checksum1 = snapshotCalculator.computeChecksum(params)
      const checksum2 = snapshotCalculator.computeChecksum(params)
      expect(checksum1).toBe(checksum2)
      expect(checksum1).toHaveLength(64)
      expect(checksum1).toMatch(/^[a-f0-9]{64}$/)
    })

    it('produces different checksums for different inputs', () => {
      const base = {
        ledgerAccountId: BigInt(1),
        businessDate: '2026-01-15',
        openingBalance: BigInt(0),
        totalInflow: BigInt(100000),
        totalOutflow: BigInt(0),
        closingBalance: BigInt(100000),
        lastEntrySequence: BigInt(1),
        entryCount: 1,
        calculationVersion: 1
      }

      const a = snapshotCalculator.computeChecksum(base)
      const b = snapshotCalculator.computeChecksum({ ...base, closingBalance: BigInt(200000) })
      expect(a).not.toBe(b)
    })
  })

  describe('verifyClosingBalance', () => {
    it('validates correct balances', () => {
      expect(snapshotCalculator.verifyClosingBalance({
        opening_balance: BigInt(100000),
        total_inflow: BigInt(500000),
        total_outflow: BigInt(200000),
        closing_balance: BigInt(400000)
      })).toBe(true)
    })

    it('detects incorrect balances', () => {
      expect(snapshotCalculator.verifyClosingBalance({
        opening_balance: BigInt(100000),
        total_inflow: BigInt(500000),
        total_outflow: BigInt(200000),
        closing_balance: BigInt(999999)
      })).toBe(false)
    })
  })

  describe('calculateCarryForward', () => {
    it('carries forward previous balance with zero movement', () => {
      const result = snapshotCalculator.calculateCarryForward(BigInt(500000))
      expect(result.openingBalance).toBe(BigInt(500000))
      expect(result.closingBalance).toBe(BigInt(500000))
      expect(result.totalInflow).toBe(BigInt(0))
      expect(result.totalOutflow).toBe(BigInt(0))
      expect(result.entryCount).toBe(0)
      expect(result.valid).toBe(true)
    })
  })
})
