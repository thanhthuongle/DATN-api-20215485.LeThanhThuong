import TransactionContext from '../core/TransactionContext'

/**
 * SnapshotRepository — database operations cho balance snapshots.
 *
 * Design contract: periodic-balance-snapshots.md §5, §8
 * Decision: DEC-020
 */

class SnapshotRepository {
  /**
   * Get ledger entries trong khoảng thời gian UTC cho một account.
   *
   * @param {TransactionContext} txContext
   * @param {object} params
   * @param {bigint} params.ledgerAccountId
   * @param {Date} params.periodStartUtc
   * @param {Date} params.periodEndUtc
   * @returns {Promise<object[]>}
   */
  async getEntriesInRange(txContext, { ledgerAccountId, periodStartUtc, periodEndUtc }) {
    TransactionContext.assertTransactionContext(txContext)

    return txContext.db.ledger_entries.findMany({
      where: {
        ledger_account_id: ledgerAccountId,
        posted_at: {
          gte: periodStartUtc,
          lt: periodEndUtc
        }
      },
      orderBy: { account_sequence: 'asc' }
    })
  }

  /**
   * Tìm snapshot hiện tại (is_current = true) cho account/date.
   *
   * @param {TransactionContext} txContext
   * @param {object} params
   * @param {bigint} params.ledgerAccountId
   * @param {Date} params.businessDate
   * @returns {Promise<object|null>}
   */
  async findCurrentSnapshot(txContext, { ledgerAccountId, businessDate }) {
    TransactionContext.assertTransactionContext(txContext)

    return txContext.db.account_balance_snapshots.findFirst({
      where: {
        ledger_account_id: ledgerAccountId,
        business_date: businessDate,
        is_current: true
      }
    })
  }

  /**
   * Lấy closing balance của ngày trước đó (dùng làm opening cho hôm nay).
   *
   * @param {TransactionContext} txContext
   * @param {object} params
   * @param {bigint} params.ledgerAccountId
   * @param {Date} params.businessDate
   * @returns {Promise<bigint>}
   */
  async getPreviousClosingBalance(txContext, { ledgerAccountId, businessDate }) {
    TransactionContext.assertTransactionContext(txContext)

    const prevDate = new Date(businessDate)
    prevDate.setUTCDate(prevDate.getUTCDate() - 1)

    const prevSnapshot = await txContext.db.account_balance_snapshots.findFirst({
      where: {
        ledger_account_id: ledgerAccountId,
        business_date: prevDate,
        is_current: true
      }
    })

    return prevSnapshot ? BigInt(prevSnapshot.closing_balance) : BigInt(0)
  }

  /**
   * Create snapshot (INSERT mới).
   *
   * @param {TransactionContext} txContext
   * @param {object} data - Snapshot fields
   * @returns {Promise<object>}
   */
  async createSnapshot(txContext, data) {
    TransactionContext.assertTransactionContext(txContext)

    return txContext.db.account_balance_snapshots.create({ data })
  }

  /**
   * Supersede snapshot cũ và tạo snapshot mới (dùng cho rebuild).
   *
   * @param {TransactionContext} txContext
   * @param {object} params
   * @param {bigint} params.currentSnapshotId
   * @param {object} params.newSnapshotData
   * @returns {Promise<object>}
   */
  async supersedeAndCreate(txContext, { currentSnapshotId, newSnapshotData }) {
    TransactionContext.assertTransactionContext(txContext)

    // Mark old as SUPERSEDED
    await txContext.db.account_balance_snapshots.update({
      where: { id: currentSnapshotId },
      data: {
        is_current: false,
        status: 'SUPERSEDED',
        updated_at: new Date()
      }
    })

    // Create new snapshot linking to old
    const newSnapshot = await txContext.db.account_balance_snapshots.create({
      data: {
        ...newSnapshotData,
        is_current: true,
        superseded_by_id: null
      }
    })

    // Update old to point to new
    await txContext.db.account_balance_snapshots.update({
      where: { id: currentSnapshotId },
      data: {
        superseded_by_id: newSnapshot.id,
        superseded_at: new Date()
      }
    })

    return newSnapshot
  }

  /**
   * Create snapshot run record.
   *
   * @param {TransactionContext} txContext
   * @param {object} params
   * @param {string} params.triggerType
   * @param {Date} params.businessDate
   * @param {string} [params.startedBy]
   * @returns {Promise<object>}
   */
  async createSnapshotRun(txContext, { triggerType, businessDate, startedBy = 'SYSTEM' }) {
    TransactionContext.assertTransactionContext(txContext)

    return txContext.db.balance_snapshot_runs.create({
      data: {
        financial_space_id: txContext.financialSpaceId,
        business_date: businessDate,
        trigger_type: triggerType,
        started_by: startedBy,
        status: 'PENDING',
        started_at: new Date()
      }
    })
  }

  /**
   * Update snapshot run status.
   *
   * @param {TransactionContext} txContext
   * @param {bigint} runId
   * @param {object} params
   * @param {string} params.status
   * @param {string} [params.errorSummary]
   * @param {object} [params.metrics]
   */
  async updateSnapshotRun(txContext, runId, { status, errorSummary, metrics }) {
    TransactionContext.assertTransactionContext(txContext)

    return txContext.db.balance_snapshot_runs.update({
      where: { id: runId },
      data: {
        status,
        error_summary: errorSummary || null,
        metrics: metrics || null,
        finished_at: status === 'COMPLETED' || status === 'FAILED' ? new Date() : null,
        updated_at: new Date()
      }
    })
  }
}

// Singleton
const snapshotRepository = new SnapshotRepository()

export default snapshotRepository
export { SnapshotRepository }
