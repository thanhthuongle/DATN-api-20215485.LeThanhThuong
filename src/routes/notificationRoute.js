import express from 'express'
import { notificationController } from '~/controllers/notificationController'
import { authMiddleware } from '~/middlewares/authMiddleware'

const Router = express.Router()

Router.route('/')
  .get(authMiddleware.isAuthorized, notificationController.getNotifications)

Router.route('/:userNotificationId')
  .put(authMiddleware.isAuthorized, notificationController.markReaded)

export const notificationRoutes = Router
