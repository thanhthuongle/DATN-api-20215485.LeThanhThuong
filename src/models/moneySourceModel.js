import Joi from 'joi'
import { OWNER_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const MONEY_SOURCE_COLLECTION_NAME = 'money_sources'
const MONEY_SOURCE_COLLECTION_SCHEMA = Joi.object({
  ownerType: Joi.string().valid(...Object.values(OWNER_TYPE)).required(),
  ownerId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  walletIds: Joi.array().items(
    Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  ).default([]),
  savings_accountIds: Joi.array().items(
    Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  ).default([]),
  accumulationIds: Joi.array().items(
    Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  ).default([]),

  totalBalance: Joi.number().integer(),
  netBalance: Joi.number().integer(),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'ownerType', 'ownerId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await MONEY_SOURCE_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

export const moneySourceModel = {
  MONEY_SOURCE_COLLECTION_NAME,
  MONEY_SOURCE_COLLECTION_SCHEMA
}
