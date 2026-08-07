import { Router } from 'express'
import {
  getSpaceBalanceSummary,
  getTransactionHistory,
  getCategorySpendReport
} from '../controllers/queryController'

const queryRoute = Router()

queryRoute.get('/spaces/:spaceId/summary', getSpaceBalanceSummary)
queryRoute.get('/spaces/:spaceId/transactions', getTransactionHistory)
queryRoute.get('/spaces/:spaceId/reports/category-spend', getCategorySpendReport)

export default queryRoute
