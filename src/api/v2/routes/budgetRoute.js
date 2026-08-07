import { Router } from 'express'
import {
  getBudgetsBySpace,
  createBudgetAllocation
} from '../controllers/budgetController'
import { validateBudgetCreation } from '../validations/budgetValidation'

const budgetRoute = Router()

budgetRoute.get('/spaces/:spaceId/budgets', getBudgetsBySpace)
budgetRoute.post('/spaces/:spaceId/budgets', validateBudgetCreation, createBudgetAllocation)

export default budgetRoute
