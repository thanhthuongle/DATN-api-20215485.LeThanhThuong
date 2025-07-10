import express from 'express'
import { loanController } from '~/controllers/loanController'
import { authMiddleware } from '~/middlewares/authMiddleware'

const Router = express.Router()

Router.route('/individual/update')
  .put(authMiddleware.isAuthorized, loanController.updateTrustLevel)

export const loanRoutes = Router
