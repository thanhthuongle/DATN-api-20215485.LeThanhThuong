import express from 'express'
import { accountController } from '~/controllers/accountController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { familyMiddleware } from '~/middlewares/familyMiddleware'
import { accountValidation } from '~/validations/accountValidation'

const Router = express.Router()

Router.route('/individual')
  .post(authMiddleware.isAuthorized, accountValidation.createNew, accountController.createIndividualAccount)

Router.route('/family/:familyId')
  .post(authMiddleware.isAuthorized, familyMiddleware.isFamilyManager, accountValidation.createNew, accountController.createFamilyAccount)

export const accountRoutes = Router
