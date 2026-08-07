import { Router } from 'express'
import { authMiddleware } from '~/middlewares/authMiddleware'
import {
  listMigrationRuns,
  getMigrationRun,
  listDiscrepancies,
  resolveDiscrepancy
} from '../controllers/migrationAdminController'

const migrationRoute = Router()

migrationRoute.get('/admin/migration/runs', authMiddleware.isAuthorized, listMigrationRuns)
migrationRoute.get('/admin/migration/runs/:id', authMiddleware.isAuthorized, getMigrationRun)
migrationRoute.get('/admin/discrepancies', authMiddleware.isAuthorized, listDiscrepancies)
migrationRoute.patch('/admin/discrepancies/:publicId/resolve', authMiddleware.isAuthorized, resolveDiscrepancy)

export default migrationRoute