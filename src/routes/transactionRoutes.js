import express from 'express'
import { transactionValidation } from '~/validations/transactionValidation'
import { transactionController } from '~/controllers/transactionController'
import { authMiddleware } from '~/middlewares/authMiddleware'

const Router = express.Router()

Router.route('/')
  .post(authMiddleware.isAuthorized, transactionValidation.createNew, transactionController.createNew)


export const transactionRoutes = Router
