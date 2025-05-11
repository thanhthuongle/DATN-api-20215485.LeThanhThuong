import express from 'express'
import { budgetController } from '~/controllers/budgetController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { familyMiddleware } from '~/middlewares/familyMiddleware'
import { budgetValidation } from '~/validations/budgetValidation'

const Router = express.Router()

Router.route('/individual')
  .get(authMiddleware.isAuthorized, budgetController.getIndividualBudgets)
  .post(authMiddleware.isAuthorized, budgetValidation.createNew, budgetController.createIndividualBudget)

Router.route('/family/:familyId')
  .get(authMiddleware.isAuthorized, familyMiddleware.isFamilyMember, budgetController.getFamilyBudgets)
  .post(authMiddleware.isAuthorized, familyMiddleware.isFamilyManager, budgetValidation.createNew, budgetController.createFamilyBudget)

export const budgetRoutes = Router
