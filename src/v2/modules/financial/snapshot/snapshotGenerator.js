import TransactionContext from '../core/TransactionContext'
import snapshotCalculator from './snapshotCalculator'
import snapshotRepository from './snapshotRepository'

/**
 * SnapshotGenerator — orchestrates idempotent daily balance snapshot generation.
 *
 * Design contract: periodic-balance-snapshots.md §3-6, §8
 * Decision: DEC-020
 */

class SnapshotGenerator {
  /**
   * Generate snapshot cho một ledger account cho một business date.
   */
  async generateAccountSnapshot(txContext, {
    ledgerAccountId,
    businessDate,
    snapshotRunId,
    calculationVersion = 1
  }) {
    TransactionContext.assertTransactionContext(txContext)

    // 1. Idempotency check
    const existing = await snapshotRepository.findCurrentSnapshot(txContext, {
      ledgerAccountId,
      businessDate
    })

    if (existing) {
      return existing
    }

    // 2. Get UTC day range
    const { periodStartUtc, periodEndUtc } = snapshotCalculator.getUtcDayRange(businessDate)

    // 3. Get previous closing balance
    const previousClosing = await snapshotRepository.getPreviousClosingBalance(txContext, {
      ledgerAccountId,
      businessDate
    })

    // 4. Get entries for the day
    const entries = await snapshotRepository.getEntriesInRange(txContext, {
      ledgerAccountId,
      periodStartUtc,
      periodEndUtc
    })

    // 5. Calculate metrics
    const calc = entries.length > 0
      ? snapshotCalculator.calculateFromEntries(entries, previousClosing)
      : snapshotCalculator.calculateCarryForward(previousClosing)


    // 6. Compute checksum
    const checksum = snapshotCalculator.computeChecksum({
      ledgerAccountId,
      businessDate: businessDate.toISOString().split('T')[0],
      openingBalance: calc.openingBalance,
      totalInflow: calc.totalInflow,
      totalOutflow: calc.totalOutflow,
      closingBalance: calc.closingBalance,
      lastEntrySequence: calc.lastEntrySequence || BigInt(0),
      entryCount: calc.entryCount,
      calculationVersion
    })

    // 7. Determine cutoff
    const cutoffPostedAt = entries.length > 0
      ? entries[entries.length - 1].posted_at
      : new Date(periodEndUtc.getTime() - 1)

    // 8. Create snapshot
    const snapshot = await snapshotRepository.createSnapshot(txContext, {
      snapshot_run_id: snapshotRunId,
      ledger_account_id: ledgerAccountId,
      financial_space_id: txContext.financialSpaceId,
      business_date: businessDate,
      period_start_utc: periodStartUtc,
      period_end_utc: periodEndUtc,
      opening_balance: calc.openingBalance,
      total_inflow: calc.totalInflow,
      total_outflow: calc.totalOutflow,
      closing_balance: calc.closingBalance,
      first_entry_sequence: calc.firstEntrySequence,
      last_entry_sequence: calc.lastEntrySequence,
      cutoff_sequence: calc.cutoffSequence,
      cutoff_posted_at: cutoffPostedAt,
      entry_count: calc.entryCount,
      calculation_version: calculationVersion,
      checksum,
      status: 'VALID',
      is_current: true,
      generated_at: new Date()
    })

    return snapshot
  }

  /**
   * Generate snapshots cho tất cả account trong space cho một ngày.
   */
  async generateDailySnapshots(txContext, { businessDate, triggerType = 'SCHEDULED' }) {
    TransactionContext.assertTransactionContext(txContext)

    const snapshotRun = await snapshotRepository.createSnapshotRun(txContext, {
      triggerType,
      businessDate
    })

    const accounts = await txContext.db.ledger_accounts.findMany({
      where: { financial_space_id: txContext.financialSpaceId, status: 'ACTIVE' }
    })

    const results = []
    let errorCount = 0

    for (const account of accounts) {
      try {
        const snapshot = await this.generateAccountSnapshot(txContext, {
          ledgerAccountId: account.id,
          businessDate,
          snapshotRunId: snapshotRun.id
        })
        results.push({ ledgerAccountId: account.id, status: 'success', snapshot })
      } catch (err) {
        errorCount++
        results.push({ ledgerAccountId: account.id, status: 'error', error: err.message })
      }
    }

    const runStatus = errorCount > 0 ? 'REQUIRES_REVIEW' : 'COMPLETED'
    await snapshotRepository.updateSnapshotRun(txContext, snapshotRun.id, {
      status: runStatus,
      metrics: {
        totalAccounts: accounts.length,
        successCount: accounts.length - errorCount,
        errorCount
      }
    })

    return { snapshotRun, accountsProcessed: accounts.length, errorCount, results }
  }

  /**
   * Catch-up: generate snapshots cho các ngày bị bỏ lỡ.
   */
  async catchUpSnapshots(txContext, { fromDate, toDate }) {
    TransactionContext.assertTransactionContext(txContext)

    const results = []
    const current = new Date(fromDate)
    const end = new Date(toDate)

    while (current <= end) {
      const dayResult = await this.generateDailySnapshots(txContext, {
        businessDate: new Date(current),
        triggerType: 'CATCH_UP'
      })
      results.push(dayResult)
      current.setUTCDate(current.getUTCDate() + 1)
    }

    return results
  }
}

// Singleton
const snapshotGenerator = new SnapshotGenerator()

export default snapshotGenerator
export { SnapshotGenerator }
