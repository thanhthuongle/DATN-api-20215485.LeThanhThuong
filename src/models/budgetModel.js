import Joi from 'joi'
import { OWNER_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const BUDGET_COLLECTION_NAME = 'budgets'
const BUDGET_COLLECTION_SCHEMA = Joi.object({
  ownerType: Joi.string().valid(...Object.values(OWNER_TYPE)).required(),
  ownerId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  categoryId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  amount: Joi.number().integer().min(0).required(),
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().required(),
  repeat: Joi.boolean().default(false),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
}).custom((obj, helpers) => {
  if (obj.startTime > obj.endTime) {
    return helpers.message('any.invalid', { message: 'startTime cannot be after endTime' })
  }
  return obj
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'ownerType', 'ownerId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await BUDGET_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

export const budgetModel = {
  BUDGET_COLLECTION_NAME,
  BUDGET_COLLECTION_SCHEMA
}
