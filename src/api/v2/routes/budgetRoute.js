import { Router } from 'express'
import { authMiddleware } from '~/middlewares/authMiddleware'
import {
  getBudgetsBySpace,
  createBudgetAllocation
} from '../controllers/budgetController'
import { validateBudgetCreation } from '../validations/budgetValidation'

const budgetRoute = Router()

budgetRoute.get('/spaces/:spaceId/budgets', authMiddleware.isAuthorized, getBudgetsBySpace)
budgetRoute.post('/spaces/:spaceId/budgets', authMiddleware.isAuthorized, validateBudgetCreation, createBudgetAllocation)

export default budgetRoute
