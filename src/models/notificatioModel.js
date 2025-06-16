import Joi, { options } from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { NOTIFICATION_TYPES } from '~/utils/constants'

// Định nghĩa Collection (name & schema)
const NOTIFICATION_COLLECTION_NAME = 'notifications'
const NOTIFICATION_COLLECTION_SCHEMA = Joi.object({
  title: Joi.string().required().min(3).max(256).trim().strict(),
  message: Joi.string().required().min(3).trim().strict(),
  type: Joi.string().valid(...Object.values(NOTIFICATION_TYPES)).required(),
  link: Joi.string().trim().strict().optional(),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await NOTIFICATION_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const createNew = async (data, options = {}) => {
  try {
    const validData = await validateBeforeCreate(data)
    const createdUser = await GET_DB().collection(NOTIFICATION_COLLECTION_NAME).insertOne(validData, options)
    return createdUser
  } catch (error) { throw new Error(error) }
}

const findOneById = async (notificationId, options = {}) => {
  try {
    const result = await GET_DB().collection(NOTIFICATION_COLLECTION_NAME).findOne({ _id: new ObjectId(String(notificationId)) }, options)
    return result
  } catch (error) { throw new Error(error) }
}

export const notificationModel = {
  NOTIFICATION_COLLECTION_NAME,
  NOTIFICATION_COLLECTION_SCHEMA,
  createNew,
  findOneById
}
