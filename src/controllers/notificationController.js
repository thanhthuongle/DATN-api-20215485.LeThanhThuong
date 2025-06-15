import { StatusCodes } from 'http-status-codes'
import { notificationService } from '~/services/notificationService'

const getNotifications = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id

    const result = await notificationService.getNotifications(userId)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const markReaded = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const userNotificationId = req.params.userNotificationId

    const result = await notificationService.markReaded(userId, userNotificationId, req.body)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}


export const notificationController = {
  getNotifications,
  markReaded
}