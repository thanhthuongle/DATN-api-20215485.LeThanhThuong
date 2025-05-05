import Joi from 'joi'
import { OWNER_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const WALLET_COLLECTION_NAME = 'wallets'
const WALLET_COLLECTION_SCHEMA = Joi.object({
  ownerType: Joi.string().valid(OWNER_TYPE.INDIVIDUAL, OWNER_TYPE.FAMILY).required(),
  moneySourceId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  walletName: Joi.string().required().min(3).max(256).trim().strict(),
  balance: Joi.number().integer().required(),
  icon: Joi.string().default(null),

  createdAt: Joi.date().timestamp('javascript').default(() => Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'ownerType', 'moneySourceId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await WALLET_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

export const userModel = {
  WALLET_COLLECTION_NAME,
  WALLET_COLLECTION_SCHEMA
}
