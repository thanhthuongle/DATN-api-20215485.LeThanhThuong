import { createHash } from 'node:crypto'

/**
 * SnapshotCalculator — pure functions for balance snapshot calculation.
 *
 * Design contract: periodic-balance-snapshots.md §3-4, §7
 * Decision: DEC-020
 *
 * - Tính opening_balance, total_inflow, total_outflow, closing_balance
 * - Checksum deterministic dùng SHA-256
 * - Timezone/day boundary resolution
 */

class SnapshotCalculator {
  /**
   * Tính khoảng thời gian UTC cho một business date.
   * Business date = UTC date (không timezone).
   *
   * @param {Date|string} businessDate - UTC date
   * @returns {{ periodStartUtc: Date, periodEndUtc: Date }}
   */
  getUtcDayRange(businessDate) {
    const d = new Date(businessDate)
    const periodStartUtc = new Date(Date.UTC(
      d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0
    ))
    const periodEndUtc = new Date(Date.UTC(
      d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0
    ))
    return { periodStartUtc, periodEndUtc }
  }

  /**
   * Tính snapshot metrics từ ledger entries trong một ngày.
   *
   * @param {object[]} entries - Ledger entries trong khoảng thời gian
   * @param {bigint} previousClosingBalance - Closing balance ngày trước (0 nếu ngày đầu)
   * @returns {object} Snapshot calculation result
   */
  calculateFromEntries(entries, previousClosingBalance = BigInt(0)) {
    let totalInflow = BigInt(0)
    let totalOutflow = BigInt(0)

    for (const entry of entries) {
      const amount = BigInt(entry.amount)
      if (amount > BigInt(0)) {
        totalInflow += amount
      } else {
        totalOutflow += -amount // Convert to positive for outflow
      }
    }

    const openingBalance = previousClosingBalance
    const closingBalance = openingBalance + totalInflow - totalOutflow

    const firstEntrySequence = entries.length > 0 ? BigInt(entries[0].account_sequence) : null
    const lastEntrySequence = entries.length > 0 ? BigInt(entries[entries.length - 1].account_sequence) : null
    const cutoffSequence = entries.length > 0
      ? BigInt(entries[entries.length - 1].account_sequence)
      : BigInt(0)

    return {
      openingBalance,
      totalInflow,
      totalOutflow,
      closingBalance,
      firstEntrySequence,
      lastEntrySequence,
      cutoffSequence,
      entryCount: entries.length,
      // Verify invariant
      valid: closingBalance === openingBalance + totalInflow - totalOutflow
    }
  }

  /**
   * Tính checksum SHA-256 cho snapshot data.
   * Deterministic — cùng inputs cho cùng checksum.
   *
   * @param {object} data
   * @param {bigint} data.ledgerAccountId
   * @param {string} data.businessDate
   * @param {bigint} data.openingBalance
   * @param {bigint} data.totalInflow
   * @param {bigint} data.totalOutflow
   * @param {bigint} data.closingBalance
   * @param {bigint} [data.lastEntrySequence]
   * @param {number} data.entryCount
   * @param {number} data.calculationVersion
   * @returns {string} 64-character hex checksum
   */
  computeChecksum({
    ledgerAccountId,
    businessDate,
    openingBalance,
    totalInflow,
    totalOutflow,
    closingBalance,
    lastEntrySequence = BigInt(0),
    entryCount,
    calculationVersion = 1
  }) {
    const canonical = [
      ledgerAccountId.toString(),
      businessDate,
      openingBalance.toString(),
      totalInflow.toString(),
      totalOutflow.toString(),
      closingBalance.toString(),
      lastEntrySequence.toString(),
      entryCount.toString(),
      calculationVersion.toString()
    ].join('|')

    return createHash('sha256').update(canonical).digest('hex')
  }

  /**
   * Verify that a snapshot's closing balance matches the calculation.
   * @param {object} snapshot
   * @returns {boolean}
   */
  verifyClosingBalance(snapshot) {
    const expected = BigInt(snapshot.opening_balance) +
      BigInt(snapshot.total_inflow) -
      BigInt(snapshot.total_outflow)
    return expected === BigInt(snapshot.closing_balance)
  }

  /**
   * Calculate carry-forward snapshot (no entries for the day).
   * @param {bigint} previousClosingBalance
   * @returns {object}
   */
  calculateCarryForward(previousClosingBalance = BigInt(0)) {
    return {
      openingBalance: previousClosingBalance,
      totalInflow: BigInt(0),
      totalOutflow: BigInt(0),
      closingBalance: previousClosingBalance,
      firstEntrySequence: null,
      lastEntrySequence: null,
      cutoffSequence: BigInt(0),
      entryCount: 0,
      valid: true
    }
  }
}

// Singleton
const snapshotCalculator = new SnapshotCalculator()

export default snapshotCalculator
export { SnapshotCalculator }
