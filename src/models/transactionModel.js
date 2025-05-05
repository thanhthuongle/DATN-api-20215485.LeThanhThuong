import Joi from 'joi'
import { OWNER_TYPE, TRANSACTION_TYPES } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const TRANSACTION_COLLECTION_NAME = 'transactions'
const TRANSACTION_COLLECTION_SCHEMA = Joi.object({
  ownerType: Joi.string().valid(OWNER_TYPE.INDIVIDUAL, OWNER_TYPE.FAMILY).required(),
  ownerId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  responsiblePersonId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE), // user: người thực hiện hoặc phê duyệt
  proposalId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  type: Joi.string().valid(TRANSACTION_TYPES.EXPENSE, TRANSACTION_TYPES.INCOME, TRANSACTION_TYPES.LOAN, TRANSACTION_TYPES.BORROWING, TRANSACTION_TYPES.TRANSFER, TRANSACTION_TYPES.CONTRIBUTION).required(),
  categoryId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  name: Joi.string().required().min(3).max(256).trim().strict(),
  description: Joi.string().required().min(3).max(256).trim().strict(),
  amount: Joi.number().integer().min(0).required(),
  transactionTime: Joi.date().timestamp('javascript').required(),

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
const INVALID_UPDATE_FIELDS = ['_id', 'ownerType', 'ownerId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await TRANSACTION_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

export const userModel = {
  TRANSACTION_COLLECTION_NAME,
  TRANSACTION_COLLECTION_SCHEMA
}
