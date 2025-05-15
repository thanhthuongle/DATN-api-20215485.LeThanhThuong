import express from 'express'
import { contactController } from '~/controllers/contactController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { familyMiddleware } from '~/middlewares/familyMiddleware'
import { contactValidation } from '~/validations/contactValidation'

const Router = express.Router()

Router.route('/individual')
  .get(authMiddleware.isAuthorized, contactController.getIndividualContacts )
  .post(authMiddleware.isAuthorized, contactValidation.createNew, contactController.createIndividualContact)

Router.route('/family/:familyId')
  .get(authMiddleware.isAuthorized, familyMiddleware.isFamilyMember, contactController.getFamilyContacts)
  .post(authMiddleware.isAuthorized, familyMiddleware.isFamilyMember, contactValidation.createNew, contactController.createFamilyContact)

export const contactRoutes = Router
