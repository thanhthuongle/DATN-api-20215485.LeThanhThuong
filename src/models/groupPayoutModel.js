import Joi from 'joi'
import { MONEY_SOURCE_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const GROUP_PAYOUT_COLLECTION_NAME = 'group_payouts'
const GROUP_PAYOUT_COLLECTION_SCHEMA = Joi.object({
  transactionId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  recipientId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE), // userID
  moneyFromType: Joi.string().valid(...Object.values(MONEY_SOURCE_TYPE)).required(),
  moneyFromId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  moneyTargetType: Joi.string().valid(...Object.values(MONEY_SOURCE_TYPE)).required(),
  moneyTargetId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  image: Joi.array().items(
    Joi.string()
  ).default([]),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'transactionId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await GROUP_PAYOUT_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

export const groupPayoutModel = {
  GROUP_PAYOUT_COLLECTION_NAME,
  GROUP_PAYOUT_COLLECTION_SCHEMA
}
