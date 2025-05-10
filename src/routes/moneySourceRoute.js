import express from 'express'
import { moneySourceController } from '~/controllers/moneySourceController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { familyMiddleware } from '~/middlewares/familyMiddleware'

const Router = express.Router()

Router.route('/individual')
  .get(authMiddleware.isAuthorized, moneySourceController.getIndividualMoneySource)

Router.route('/family/:familyId')
  .get(authMiddleware.isAuthorized, familyMiddleware.isFamilyMember, moneySourceController.getFamilyMoneySource)

export const moneySourceRoutes = Router