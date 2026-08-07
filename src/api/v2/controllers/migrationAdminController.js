import migrationAdminService from '~/v2/modules/migration/services/migrationAdmin.service'
import {
  toMigrationRunListResponse,
  toMigrationRunResponse,
  toDiscrepancyListResponse,
  toDiscrepancyResponse
} from '../mappers/migrationMapper'

export const listMigrationRuns = async (req, res, next) => {
  try {
    const { status, runType, limit } = req.query
    const result = await migrationAdminService.listRuns({ status, runType, limit: limit ? Number(limit) : undefined })
    res.json({ data: toMigrationRunListResponse(result) })
  } catch (error) {
    next(error)
  }
}

export const getMigrationRun = async (req, res, next) => {
  try {
    const result = await migrationAdminService.getRun(Number(req.params.id))
    if (!result) {
      res.status(404).json({ statusCode: 404, message: 'Migration run not found' })
      return
    }
    res.json({ data: toMigrationRunResponse(result) })
  } catch (error) {
    next(error)
  }
}

export const listDiscrepancies = async (req, res, next) => {
  try {
    const { status, severity, source, limit } = req.query
    const result = await migrationAdminService.listDiscrepancies({
      status, severity, source, limit: limit ? Number(limit) : undefined
    })
    res.json({ data: toDiscrepancyListResponse(result) })
  } catch (error) {
    next(error)
  }
}

export const resolveDiscrepancy = async (req, res, next) => {
  try {
    const { publicId } = req.params
    const { resolutionNote, resolvedByUserId, resolutionAction } = req.body
    const result = await migrationAdminService.resolveDiscrepancy({
      publicId,
      resolutionNote,
      resolvedByUserId: resolvedByUserId ? BigInt(resolvedByUserId) : null,
      resolutionAction
    })
    if (!result) {
      res.status(404).json({ statusCode: 404, message: 'Discrepancy not found' })
      return
    }
    res.json({ data: toDiscrepancyResponse(result) })
  } catch (error) {
    next(error)
  }
}