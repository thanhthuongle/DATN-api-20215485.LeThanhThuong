/* eslint-disable no-useless-catch */
import { notificationModel } from '~/models/notificatioModel'
import { userNotificationModel } from '~/models/userNotificationModel'
import { getIO, getUserSockets } from '~/sockets'
import { NOTIFICATION_TYPES } from '~/utils/constants'

const createNew = async (userId, notificationData) => {
  try {
    const newNotification = {
      title: notificationData?.title,
      message: notificationData?.message,
      type: notificationData?.type
    }
    if (notificationData?.link) {
      newNotification.type = NOTIFICATION_TYPES.LINK,
      newNotification.link = notificationData.link
    } else newNotification.type = NOTIFICATION_TYPES.TEXT

    const createdNotification = await notificationModel.createNew(newNotification)
    const getNewNotification = await notificationModel.findOneById(createdNotification.insertedId)

    const newUserNotification = {
      userId: userId,
      notificationId: createdNotification.insertedId.toString()
    }
    const createdUserNotification = await userNotificationModel.createNew(newUserNotification)
    const getNewUserNotification = await userNotificationModel.findOneById(createdUserNotification.insertedId)
    const result = {
      ...getNewUserNotification,
      notificationData: getNewNotification
    }

    // Gửi thông báo real-time
    const io = getIO()
    const userSockets = getUserSockets()
    const sockets = userSockets.get(userId)
    if (sockets && sockets.size > 0) {
      for (const socketId of sockets) {
        io.to(socketId).emit('notification', result)
      }
      // console.log(`📨 Gửi thông báo tới user ${userId} (${sockets.size} thiết bị)`)
    } else {
      // console.log(`📭 User ${userId} hiện không online`)
    }

    return result
  } catch (error) { throw error }
}

const getNotifications = async (userId) => {
  try {
    const result = await userNotificationModel.findByUserId(userId)

    return result
  } catch (error) { throw error }
}

const markReaded = async (userId, userNotificationId, reqBody) => {
  try {
    const result = await userNotificationModel.markReaded(userId, userNotificationId)

    return result
  } catch (error) { throw error }
}

export const notificationService = {
  createNew,
  getNotifications,
  markReaded
}
