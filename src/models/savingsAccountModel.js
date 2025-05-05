import Joi from 'joi'
import { OWNER_TYPE, INTEREST_PAID, TERM_ENDED, MONEY_SOURCE_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const SAVINGS_ACCOUNT_COLLECTION_NAME = 'savings_accounts'
const SAVINGS_ACCOUNT_COLLECTION_SCHEMA = Joi.object({
  ownerType: Joi.string().valid(...Object.values(OWNER_TYPE)).required(),
  moneySourceId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  savingsAccountName: Joi.string().required().min(3).max(256).trim().strict(),
  bankId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  initBalance: Joi.number().integer().min(0).required(),
  balance: Joi.number().integer().min(0).required(),
  rate: Joi.string().trim()
    .custom((value, helpers) => {
      const normalized = value.replace(',', '.')
      const num = parseFloat(normalized)
      if (isNaN(num)) {
        return helpers.error('any.invalid')
      }
      if (num < 0 || num > 100) {
        return helpers.error('number.outOfRange', { value: num })
      }

      return num
    }, 'Parse and validate interest rate')
    .required(),
  startDate: Joi.date().timestamp('javascript').required(),
  term: Joi.string().required().trim().strict(), // Kỳ hạn
  interestPaid: Joi.string().valid(...Object.values(INTEREST_PAID)).required(), // Thời gian trả lãi
  termEnded: Joi.string().valid(...Object.values(TERM_ENDED)).required(), // hành động khi hết kỳ hạn: ROLL_OVER_PRINCIPAL_AND_INTEREST chỉ tồn tại khi trả lãi vào cuối kỳ
  interestPaidTargetId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  interestPaidTargetType: Joi.string().valid(MONEY_SOURCE_TYPE.WALLET).required(),
  description: Joi.string().trim().strict().optional(),
  isClosed: Joi.boolean().default(false),

  moneyFromType: Joi.string().valid(MONEY_SOURCE_TYPE.WALLET).required(),
  moneyFromId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'ownerType', 'moneySourceId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await SAVINGS_ACCOUNT_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

export const userModel = {
  SAVINGS_ACCOUNT_COLLECTION_NAME,
  SAVINGS_ACCOUNT_COLLECTION_SCHEMA
}
