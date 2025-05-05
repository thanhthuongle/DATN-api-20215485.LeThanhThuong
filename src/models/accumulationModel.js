import Joi from 'joi'
import { OWNER_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const ACCUMULATION_COLLECTION_NAME = 'accumulations'
const ACCUMULATION_COLLECTION_SCHEMA = Joi.object({
  ownerType: Joi.string().valid(OWNER_TYPE.INDIVIDUAL, OWNER_TYPE.FAMILY).required(),
  moneySourceId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  accumulationName: Joi.string().required().min(3).max(256).trim().strict(),
  balance: Joi.number().integer().min(0).default(0),
  targetBalance: Joi.number().integer().min(0).required(),
  startDate: Joi.date().timestamp('javascript').required(),
  endDate: Joi.date().timestamp('javascript').required(),
  isFinish: Joi.boolean().default(false),

  createdAt: Joi.date().timestamp('javascript').default(() => Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
}).custom((obj, helpers) => {
  if (obj.startDate > obj.endDate) {
    return helpers.message('any.invalid', { message: 'startDate cannot be after endDate' })
  }
  return obj
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'ownerType', 'moneySourceId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await ACCUMULATION_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

export const userModel = {
  ACCUMULATION_COLLECTION_NAME,
  ACCUMULATION_COLLECTION_SCHEMA
}
