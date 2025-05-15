import express from 'express'
import { contactController } from '~/controllers/contactController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { familyMiddleware } from '~/middlewares/familyMiddleware'

const Router = express.Router()

Router.route('/individual')
  .get(authMiddleware.isAuthorized, contactController.getIndividualContacts )

Router.route('/family/:familyId')
  .get(authMiddleware.isAuthorized, familyMiddleware.isFamilyMember, contactController.getFamilyContacts)

export const contactRoutes = Router
