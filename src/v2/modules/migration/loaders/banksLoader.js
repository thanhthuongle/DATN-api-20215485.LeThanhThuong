import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'
import migrationRunRepository from '../repositories/migrationRun.repository'

/**
 * BanksLoader — default transform example (L1 reference seed, no secrets).
 *
 * Reads `migration_source_records` staged for the `banks` collection, loads
 * each into the V2 `banks` table keyed by `legacy_mongo_id`, then marks the
 * source record LOADED. Idempotent: a bank already loaded with the same legacy
 * id is skipped rather than duplicated.
 *
 * Rule: MIG-003 (docs/v2/migration/migration-rule-catalog.md) — map
 * code/name/logo; duplicate code is a discrepancy, never auto-merged.
 */
class BanksLoader {
  constructor(deps = {}) {
    this.runRepo = deps.runRepo || migrationRunRepository
    this.prisma = deps.prisma || null
  }

  _db(tx) {
    return tx || this.prisma || getPrismaClient()
  }

  /**
   * @param {object} params
   * @param {bigint} params.runId
   */
  async load({ runId }) {
    const prisma = this._db()
    const records = await prisma.migration_source_records.findMany({
      where: {
        migration_run_id: runId,
        source_collection: 'banks',
        disposition: 'STAGED'
      },
      orderBy: { id: 'asc' }
    })

    let loaded = 0
    let rejected = 0
    for (const record of records) {
      const raw = record.raw_document || {}
      const code = String(raw.code ?? '').trim()
      const name = String(raw.name ?? '').trim()
      if (!code || !name) {
        if (!record.reject_code) {
          await this.runRepo.markSourceRejected(runId, 'banks', record.source_legacy_id, 'INVALID_FINANCIAL_VALUE')
        }
        rejected += 1
        continue
      }

      const created = await prisma.$transaction(async (tx) => {
        const existing = await tx.banks.findUnique({
          where: { legacy_mongo_id: record.source_legacy_id }
        })
        if (existing) return existing
        return tx.banks.create({
          data: {
            legacy_mongo_id: record.source_legacy_id,
            code,
            name,
            logo_url: raw.logo || raw.logo_url || null
          }
        })
      })

      if (!record.target_public_id) {
        await this.runRepo.markSourceLoaded(runId, 'banks', record.source_legacy_id, {
          targetType: 'banks',
          targetPublicId: created.public_id
        })
      }
      loaded += 1
    }

    return { loaded, rejected }
  }
}

const banksLoader = new BanksLoader()
export default banksLoader
export { BanksLoader }