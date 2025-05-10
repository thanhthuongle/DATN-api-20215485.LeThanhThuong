import express from 'express'
import { accumulationController } from '~/controllers/accumulationController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { familyMiddleware } from '~/middlewares/familyMiddleware'
import { accumulationValidation } from '~/validations/accumulationValidation'

const Router = express.Router()

Router.route('/individual')
  .post(authMiddleware.isAuthorized, accumulationValidation.createNew, accumulationController.createIndividualAccumulation)

Router.route('/family/:familyId')
  .post(authMiddleware.isAuthorized, familyMiddleware.isFamilyManager, accumulationValidation.createNew, accumulationController.createFamilyAccumulation)

export const accumulationRoutes = Router
