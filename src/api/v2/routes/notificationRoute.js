import { Router } from 'express'
import { authMiddleware } from '~/middlewares/authMiddleware'
import {
  getNotifications,
  markReaded
} from '../controllers/notificationController'

const notificationRoute = Router()

notificationRoute.get('/notifications', authMiddleware.isAuthorized, getNotifications)
notificationRoute.put('/notifications/:userNotificationId', authMiddleware.isAuthorized, markReaded)

export default notificationRoute
