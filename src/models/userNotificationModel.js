import Joi, { options } from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { OWNER_TYPE } from '~/utils/constants'
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

const findOneById = async (userNotificationId, options = {}) => {
  try {
    const result = await GET_DB().collection(USER_NOTIFICATION_COLLECTION_NAME).findOne({ _id: new ObjectId(userNotificationId) }, options)

    return result
  } catch (error) { throw new Error(error) }
}

const findByUserId = async (userId, options = {}) => {
  try {
    const filter = {}
    filter.userId = new ObjectId(userId)

    const result = await GET_DB().collection(USER_NOTIFICATION_COLLECTION_NAME)
      .aggregate([
        {
          $match: filter
        },
        {
          $lookup : {
            from: 'notifications',
            localField: 'notificationId',
            foreignField: '_id',
            as: 'notificationData'
          }
        },
        {
          $unwind: '$notificationData'
        },
        {
          $sort: { _id: -1, readAt: -1 } // sort theo thời gian đọc hoặc tạo mới nhất
        }
      ], options).toArray()
    return result
  } catch (error) { throw new Error(error) }
}

const markReaded = async (userId, userNotificationId, options = {}) => {
  try {
    const filter = {
      _id: new ObjectId(userNotificationId),
      userId: new ObjectId(userId),
      isRead: false
    }
    const result = await GET_DB().collection(USER_NOTIFICATION_COLLECTION_NAME).findOneAndUpdate(
      filter,
      { $set: { isRead: true, readAt: Date.now() } },
      { returnDocument: 'after', ...options }
    )

    return result
  } catch (error) { throw new Error(error) }
}

export const userNotificationModel = {
  USER_NOTIFICATION_COLLECTION_NAME,
  USER_NOTIFICATION_COLLECTION_SCHEMA,
  findOneById,
  findByUserId,
  markReaded
}
