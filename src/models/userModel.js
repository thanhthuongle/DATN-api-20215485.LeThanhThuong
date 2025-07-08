import Joi from 'joi'
import { EMAIL_RULE, EMAIL_RULE_MESSAGE } from '~/utils/validators'
import { GET_DB } from '~/config/mongodb'
import { ObjectId } from 'mongodb'
import moment from 'moment'
import { CURRENCIES, LANGUAGES } from '~/utils/constants'

// Định nghĩa Collection (name & schema)
const USER_COLLECTION_NAME = 'users'
const USER_COLLECTION_SCHEMA = Joi.object({
  email: Joi.string().required().pattern (EMAIL_RULE).message(EMAIL_RULE_MESSAGE),
  password: Joi.string().required(),

  username: Joi.string().required().trim(),
  displayName: Joi.string().required().trim(),
  avatar: Joi.string().default(null),

  isActive: Joi.boolean().default(false),
  verifyToken: Joi.string().allow(null).default(null),

  language: Joi.string().valid(...Object.values(LANGUAGES)).default(LANGUAGES.VIE),
  currency: Joi.string().valid(...Object.values(CURRENCIES)).default(CURRENCIES.VND),

  remindToInput: Joi.boolean().default(true),
  remindTime: Joi.date().iso().default(moment().hour(12).minute(0).second(0).millisecond(0).toISOString()),

  startDayOfWeek: Joi.string().default('MONDAY'),
  startDayOfMonth: Joi.number().integer().min(1).default(1),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'email', 'username', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await USER_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const createNew = async (data) => {
  try {
    const validData = await validateBeforeCreate(data)
    const createdUser = await GET_DB().collection(USER_COLLECTION_NAME).insertOne(validData)
    return createdUser
  } catch (error) { throw new Error(error) }
}

const findOneById = async (userId, options = {}) => {
  try {
    const result = await GET_DB().collection(USER_COLLECTION_NAME).findOne({ _id: new ObjectId(String(userId)) }, options)
    return result
  } catch (error) { throw new Error(error) }
}

const findOneByEmail = async (emailValue) => {
  try {
    const result = await GET_DB().collection(USER_COLLECTION_NAME).findOne({ email: emailValue })
    return result
  } catch (error) { throw new Error(error) }
}

const update = async (userId, updateData) => {
  try {
    Object.keys(updateData).forEach(fieldName => {
      if (INVALID_UPDATE_FIELDS.includes (fieldName)) {
        delete updateData [fieldName]
      }
    })

    const result = await GET_DB().collection(USER_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(String(userId)) },
      { $set: updateData },
      { returnDocument: 'after' }
    )
    return result
  } catch (error) { throw new Error(error) }
}

export const userModel = {
  USER_COLLECTION_NAME,
  USER_COLLECTION_SCHEMA,
  createNew,
  findOneById,
  findOneByEmail,
  update
}
