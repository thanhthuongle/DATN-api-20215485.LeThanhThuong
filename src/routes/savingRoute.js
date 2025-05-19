import express from 'express'
import { savingController } from '~/controllers/savingController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { familyMiddleware } from '~/middlewares/familyMiddleware'
import { savingValidation } from '~/validations/savingValidation'

const Router = express.Router()

Router.route('/individual')
  .get(authMiddleware.isAuthorized, savingController.getIndividualSavings)
  .post(authMiddleware.isAuthorized, savingValidation.createNew, savingController.createIndividualSaving)

Router.route('/family/:familyId')
  .post(authMiddleware.isAuthorized, familyMiddleware.isFamilyManager, savingValidation.createNew, savingController.createFamilySaving)

export const savingRoutes = Router
