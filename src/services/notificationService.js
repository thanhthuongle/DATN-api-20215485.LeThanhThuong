/* eslint-disable no-useless-catch */
import { userNotificationModel } from '~/models/userNotificationModel'

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
  getNotifications,
  markReaded
}
