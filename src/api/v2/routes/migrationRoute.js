import { Router } from 'express'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { adminAuthMiddleware } from '../middlewares/adminAuth'
import {
  listMigrationRuns,
  getMigrationRun,
  listDiscrepancies,
  resolveDiscrepancy
} from '../controllers/migrationAdminController'

const migrationRoute = Router()

migrationRoute.get('/admin/migration/runs', authMiddleware.isAuthorized, adminAuthMiddleware.isAdmin, listMigrationRuns)
migrationRoute.get('/admin/migration/runs/:id', authMiddleware.isAuthorized, adminAuthMiddleware.isAdmin, getMigrationRun)
migrationRoute.get('/admin/discrepancies', authMiddleware.isAuthorized, adminAuthMiddleware.isAdmin, listDiscrepancies)
migrationRoute.patch('/admin/discrepancies/:publicId/resolve', authMiddleware.isAuthorized, adminAuthMiddleware.isAdmin, resolveDiscrepancy)

export default migrationRoute