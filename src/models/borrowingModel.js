import Joi from 'joi'
import { MONEY_SOURCE_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const BORROWING_COLLECTION_NAME = 'borrowings'
const BORROWING_COLLECTION_SCHEMA = Joi.object({
  transactionId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  moneyTargetType: Joi.string().valid(MONEY_SOURCE_TYPE.WALLET, MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT, MONEY_SOURCE_TYPE.ACCUMULATION).required(),
  moneyTargetId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  lenderId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  repaymentTime: Joi.date().timestamp('javascript').default(null),
  image: Joi.array().items(
    Joi.string()
  ).default([]),

  createdAt: Joi.date().timestamp('javascript').default(() => Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'transactionId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await BORROWING_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

export const userModel = {
  BORROWING_COLLECTION_NAME,
  BORROWING_COLLECTION_SCHEMA
}
