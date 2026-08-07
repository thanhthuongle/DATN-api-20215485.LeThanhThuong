import notificationService from '~/v2/modules/notification/services/notification.service'
import { toNotificationListResponse, toNotificationResponse } from '../mappers/notificationMapper'

export const getNotifications = async (req, res, next) => {
  try {
    const userId = BigInt(req.userId || req.body.userId)
    const limit = Number(req.query?.limit) || 20
    const result = await notificationService.getNotifications(userId, limit)
    res.json({ data: toNotificationListResponse(result) })
  } catch (error) {
    next(error)
  }
}

export const markReaded = async (req, res, next) => {
  try {
    const userId = BigInt(req.userId || req.body.userId)
    const result = await notificationService.markReaded(userId, req.params.userNotificationId)
    res.json({ data: toNotificationResponse(result) })
  } catch (error) {
    next(error)
  }
}
