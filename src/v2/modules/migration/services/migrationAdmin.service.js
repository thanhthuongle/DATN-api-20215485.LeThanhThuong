import migrationRunRepository from '../repositories/migrationRun.repository'
import discrepancyManager from './discrepancyManager.service'
import reconciliationEngine from './reconciliationEngine.service'

/**
 * MigrationAdminService — read/operate endpoints for migration runs and
 * discrepancy cases exposed under `/api/v2/admin`. These are view and
 * controlled-resolution operations only; no balance or ledger is ever fixed
 * directly (DEC-026, admin-operations.md).
 */
class MigrationAdminService {
  async listRuns({ status, runType, limit } = {}) {
    return migrationRunRepository.listRuns({ status, runType, limit: limit || 50 })
  }

  async getRun(runId) {
    const run = await migrationRunRepository.findRunById(runId)
    if (!run) return null
    const discrepancySummary = await discrepancyManager.statusSummary({ migrationRunId: runId })
    const reconciliation = await reconciliationEngine.run()
    return { run, discrepancySummary, reconciliation }
  }

  async listDiscrepancies({ status, severity, source, limit } = {}) {
    return discrepancyManager.list({ status, severity, source, limit: limit || 100 })
  }

  async resolveDiscrepancy({ publicId, resolutionNote, resolvedByUserId, resolutionAction }) {
    return discrepancyManager.resolve({ publicId, resolutionNote, resolvedByUserId, resolutionAction })
  }
}

const migrationAdminService = new MigrationAdminService()
export default migrationAdminService
export { MigrationAdminService }