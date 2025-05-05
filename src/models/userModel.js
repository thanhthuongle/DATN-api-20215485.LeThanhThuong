import Joi from 'joi'
import { EMAIL_RULE, EMAIL_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const USER_COLLECTION_NAME = 'users'
const USER_COLLECTION_SCHEMA = Joi.object({
  email: Joi.string().required().pattern (EMAIL_RULE).message(EMAIL_RULE_MESSAGE),
  password: Joi.string().required(),

  username: Joi.string().required().trim().strict(),
  displayName: Joi.string().required().trim().strict(),
  avatar: Joi.string().default(null),

  isActive: Joi.boolean().default(false),
  verifyToken: Joi.string().allow(null).default(null),

  language: Joi.string().default('VN'),
  currency: Joi.string().default('VND'),

  remindToInput: Joi.boolean().default(false),
  remindTime: Joi.date().timestamp('javascript').default(null),

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

export const userModel = {
  USER_COLLECTION_NAME,
  USER_COLLECTION_SCHEMA
}
