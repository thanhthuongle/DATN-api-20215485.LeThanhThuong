import express from 'express'
import { bankController } from '~/controllers/bankController'
import { authMiddleware } from '~/middlewares/authMiddleware'

const Router = express.Router()

Router.route('/')
  .get(authMiddleware.isAuthorized, bankController.getBanks)

Router.route('/:bankId')
  .get(authMiddleware.isAuthorized, bankController.getDetail)

export const bankRoutes = Router
