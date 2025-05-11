import express from 'express'
import { familyController } from '~/controllers/familyController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { multerUploadMiddleware } from '~/middlewares/multerUploadMiddleware'
import { familyValidation } from '~/validations/familyValidation'

const Router = express.Router()

Router.route('/')
  .get(authMiddleware.isAuthorized, familyController.getFamilies ) // Lấy danh sách gia đình
  .post(
    authMiddleware.isAuthorized,
    multerUploadMiddleware.upload.single('backgroundImage'),
    familyValidation.createNew,
    familyController.createNew
  ) // Tạo mới gia đình


export const familyRoutes = Router
