/* eslint-disable no-useless-catch */
import { notificationModel } from '~/models/notificatioModel'
import { userNotificationModel } from '~/models/userNotificationModel'

const createNew = async (userId, notificationData) => {
  try {
    const newNotification = {
      title: notificationData?.title,
      message: notificationData?.message,
      type: notificationData?.type,
    }
    if (notificationData?.link) newNotification.link = notificationData.link

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
