import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'

/**
 * MigrationAnchorService — approved legacy balance resolution anchors.
 *
 * When reconstructed balance differs from the legacy stored balance, the
 * difference is only applied through a `migration_anchor_details` row tied to
 * a `MIGRATION_EQUITY` posting, an approved discrepancy case, and a checksum.
 * No implicit/silent balance adjustment ever happens (DEC-026, DEC-044,
 * final-migration-strategy.md "Legacy balance resolution").
 */

class MigrationAnchorService {
  _db(tx) {
    return tx || getPrismaClient()
  }

  /**
   * Insert a migration anchor for a MIGRATION_EQUITY counter-post.
   * @param {object} params
   * @param {bigint} params.financialTransactionId
   * @param {bigint} params.ledgerAccountId
   * @param {bigint} params.migrationRunId
   * @param {bigint} params.discrepancyCaseId
   * @param {bigint} params.sourceLegacyBalance
   * @param {bigint} params.reconstructedBalance
   * @param {bigint} params.differenceAmount
   * @param {string} params.sourceChecksum
   * @param {bigint} params.approvalActorUserId
   * @param {string} params.approvalReason
   */
  async createAnchor({
    financialTransactionId, ledgerAccountId, migrationRunId, discrepancyCaseId,
    sourceLegacyBalance, reconstructedBalance, differenceAmount, sourceChecksum,
    approvalActorUserId, approvalReason
  }, tx) {
    if (BigInt(sourceLegacyBalance) === BigInt(reconstructedBalance)) {
      throw new Error('migration anchor requires a non-zero difference')
    }
    if (BigInt(differenceAmount) !== BigInt(sourceLegacyBalance) - BigInt(reconstructedBalance)) {
      throw new Error('migration anchor difference must equal source - reconstructed')
    }
    if (!approvalReason || !approvalActorUserId) {
      throw new Error('migration anchor requires approver and reason')
    }
    const db = this._db(tx)
    return db.migration_anchor_details.create({
      data: {
        financial_transaction_id: financialTransactionId,
        ledger_account_id: ledgerAccountId,
        migration_run_id: migrationRunId,
        discrepancy_case_id: discrepancyCaseId,
        source_legacy_balance: sourceLegacyBalance,
        reconstructed_balance: reconstructedBalance,
        difference_amount: differenceAmount,
        source_checksum: sourceChecksum,
        approval_actor_user_id: approvalActorUserId,
        approval_reason: approvalReason,
        approved_at: new Date()
      }
    })
  }
}

const migrationAnchorService = new MigrationAnchorService()
export default migrationAnchorService
export { MigrationAnchorService }