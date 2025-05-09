import express from 'express'
import { categoryController } from '~/controllers/categoryController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { familyMiddleware } from '~/middlewares/familyMiddleware'

const Router = express.Router()

Router.route('/individual')
  .get(authMiddleware.isAuthorized, categoryController.getIndividualCategories)

Router.route('/family/:familyId')
  .get(authMiddleware.isAuthorized, familyMiddleware.isFamilyMember, categoryController.getFamilyCategories)

export const categoryRoutes = Router