import { Router } from 'express'
import {
  getNotifications,
  markReaded
} from '../controllers/notificationController'

const notificationRoute = Router()

notificationRoute.get('/notifications', getNotifications)
notificationRoute.put('/notifications/:userNotificationId', markReaded)

export default notificationRoute
