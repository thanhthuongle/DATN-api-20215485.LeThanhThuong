import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { agenda } from '~/agenda/agenda'
import { notificationService } from '~/services/notificationService'
import { AGENDA_NOTIFICATION_TYPES } from '~/utils/constants'

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

const testSocketIO = async (req, res, next) => {
  try {
    const newNotificationDataTest = {
      userId: new ObjectId(req.jwtDecoded._id),
      title: 'Test socket',
      message: 'Test thông báo real-time qua socket',
      jobType: AGENDA_NOTIFICATION_TYPES.NOTICE
    }
    const result = await agenda.now('send_reminder', newNotificationDataTest)
    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error)}
}


export const notificationController = {
  getNotifications,
  markReaded,
  testSocketIO
}
