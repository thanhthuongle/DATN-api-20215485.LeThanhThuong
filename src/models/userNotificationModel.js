import Joi from 'joi'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const USER_NOTIFICATION_COLLECTION_NAME = 'user_notifications'
const USER_NOTIFICATION_COLLECTION_SCHEMA = Joi.object({
  userId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  notificationId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  isRead: Joi.boolean().default(false),
  readAt: Joi.date().timestamp('javascript').default(null),
  receiveAt: Joi.date().timestamp('javascript').default(() => Date.now)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'userId', 'notificationId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await USER_NOTIFICATION_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

export const userNotificationModel = {
  USER_NOTIFICATION_COLLECTION_NAME,
  USER_NOTIFICATION_COLLECTION_SCHEMA
}
