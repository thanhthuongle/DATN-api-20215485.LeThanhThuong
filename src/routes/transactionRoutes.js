import express from 'express'
import { transactionValidation } from '~/validations/transactionValidation'
import { transactionController } from '~/controllers/transactionController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { familyMiddleware } from '~/middlewares/familyMiddleware'

const Router = express.Router()

Router.route('/')
  .post(authMiddleware.isAuthorized, transactionValidation.createNew, transactionController.createNew)

Router.route('/individual')
  .get(authMiddleware.isAuthorized, transactionController.getIndividualTransactions)
  .post(authMiddleware.isAuthorized, transactionValidation.createNew, transactionController.createIndividualTransaction)

Router.route('/individual/:transactionId')
  .get(authMiddleware.isAuthorized, transactionController.getDetailIndividualTransaction)

Router.route('/family/:familyId')
  .get(authMiddleware.isAuthorized, familyMiddleware.isFamilyMember, transactionController.getFamilyTransactions)
  .post(authMiddleware.isAuthorized, familyMiddleware.isFamilyManager, transactionValidation.createNew, transactionController.createFamilyTransaction)

Router.route('/family/:familyId/:transactionId')
  .get(authMiddleware.isAuthorized, familyMiddleware.isFamilyMember, transactionController.getDetailFamilyTransaction)

export const transactionRoutes = Router
