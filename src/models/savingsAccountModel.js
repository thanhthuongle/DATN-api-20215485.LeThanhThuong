import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { OWNER_TYPE, INTEREST_PAID, TERM_ENDED, MONEY_SOURCE_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const SAVINGS_ACCOUNT_COLLECTION_NAME = 'savings_accounts'
const SAVINGS_ACCOUNT_COLLECTION_SCHEMA = Joi.object({
  ownerType: Joi.string().valid(...Object.values(OWNER_TYPE)).required(),
  ownerId: Joi.string().optional().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  moneySourceId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  savingsAccountName: Joi.string().required().min(3).max(256).trim().strict(),
  bankId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  initBalance: Joi.number().integer().min(0).required(),
  balance: Joi.number().integer().min(0).required(),
  rate: Joi.number().precision(2).min(0).max(100).required(),
  nonTermRate: Joi.number().precision(2).min(0).max(100).required(),
  startDate: Joi.date().iso().required(),
  term: Joi.number().integer().min(1), // Kỳ hạn: 1m 2m 6m ....: đơn vị tháng
  interestPaid: Joi.string().valid(...Object.values(INTEREST_PAID)).required(), // Thời gian trả lãi
  termEnded: Joi.string().valid(...Object.values(TERM_ENDED)).required(), // hành động khi hết kỳ hạn: ROLL_OVER_PRINCIPAL_AND_INTEREST chỉ tồn tại khi trả lãi vào cuối kỳ
  interestPaidTargetId: Joi.string().optional().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  interestPaidTargetType: Joi.string().valid(MONEY_SOURCE_TYPE.ACCOUNT).optional(),
  description: Joi.string().trim().strict().optional(),
  isClosed: Joi.boolean().default(false),
  isRolledOver: Joi.boolean().default(false),
  parentSavingId: Joi.string().optional().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  transactionIds: Joi.array().items(
    Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  ).default([]),

  moneyFromType: Joi.string().valid(MONEY_SOURCE_TYPE.ACCOUNT).required(),
  moneyFromId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
}).custom((value, helpers) => {
  const { interestPaid, termEnded, interestPaidTargetId, interestPaidTargetType } = value

  // 1. Nếu interestPaid !== "maturity", thì không được chọn ROLL_OVER_PRINCIPAL_AND_INTEREST
  if (
    interestPaid !== INTEREST_PAID.MATURITY &&
    termEnded === TERM_ENDED.ROLL_OVER_PRINCIPAL_AND_INTEREST
  ) {
    return helpers.message(
      'Không thể tái tục gốc và lãi khi trả lãi không phải vào cuối kỳ'
    )
  }

  // 2. Nếu interestPaid !== "maturity", thì bắt buộc phải có interestPaidTargetId + Type
  const isInterestTargetRequired = interestPaid !== INTEREST_PAID.MATURITY
  if (isInterestTargetRequired) {
    if (!interestPaidTargetId) {
      return helpers.message('Thông tin tài khoản nhận lãi là bắt buộc')
    }
    if (!interestPaidTargetType) {
      return helpers.message('Thông tin tài khoản nhận lãi là bắt buộc')
    }
  }

  // 3. Nếu interestPaid === "maturity", thì 2 field kia không nên có
  if (interestPaid === INTEREST_PAID.MATURITY) {
    if (interestPaidTargetId || interestPaidTargetType) {
      return helpers.message('Thông tin tài khoản nhận lãi là không cần thiết')
    }
  }

  return value
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'ownerType', 'moneySourceId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await SAVINGS_ACCOUNT_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const createNew = async (data, options = {}) => {
  try {
    const validData = await validateBeforeCreate(data)
    const createdAccount = GET_DB().collection(SAVINGS_ACCOUNT_COLLECTION_NAME).insertOne({
      ...validData,
      ownerId: new ObjectId(validData.ownerId),
      moneySourceId: new ObjectId(validData.moneySourceId),
      bankId: new ObjectId(validData.bankId),
      moneyFromId: new ObjectId(validData.moneyFromId),
      ...(validData.interestPaidTargetId && { interestPaidTargetId: new ObjectId(validData.interestPaidTargetId) }),
      ...(validData.parentSavingId && { parentSavingId: new ObjectId(validData.parentSavingId) })
    }, options)

    return createdAccount
  } catch (error) { throw new Error(error) }
}

const decreaseBalance = async (accountId, amount, options = {}) => {
  try {
    const result = await GET_DB().collection(SAVINGS_ACCOUNT_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(accountId) },
      {
        $inc: { balance: -amount },
        $set: { updatedAt: Date.now() }
      },
      { returnDocument: 'after',
        ...options
      }
    )

    return result
  } catch (error) { throw new Error(error) }
}

const increaseBalance = async (accountId, amount, options = {}) => {
  try {
    const result = await GET_DB().collection(SAVINGS_ACCOUNT_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(accountId) },
      {
        $inc: { balance: amount },
        $set: { updatedAt: Date.now() }
      },
      { returnDocument: 'after',
        ...options
      }
    )

    return result
  } catch (error) { throw new Error(error) }
}

const findOneById = async (savingsId, options = {}) => {
  try {
    const result = await GET_DB().collection(SAVINGS_ACCOUNT_COLLECTION_NAME).findOne({ _id: new ObjectId(String(savingsId)) }, options)
    return result
  } catch (error) { throw new Error(error) }
}

const pushTransactionIds = async (savingsId, transactionId, options = {}) => {
  try {
    const result = await GET_DB().collection(SAVINGS_ACCOUNT_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(String(savingsId)) },
      { $push: { transactionIds: new ObjectId(String(transactionId)) } },
      { returnDocument: 'after', ...options }
    )

    return result
  } catch (error) { throw new Error(error) }
}

const getSavings = async (filter, options = {}) => {
  try {
    const result = await GET_DB().collection(SAVINGS_ACCOUNT_COLLECTION_NAME).find(filter, options).toArray()
    return result
  } catch (error) { throw new Error(error) }
}

export const savingsAccountModel = {
  SAVINGS_ACCOUNT_COLLECTION_NAME,
  SAVINGS_ACCOUNT_COLLECTION_SCHEMA,
  createNew,
  decreaseBalance,
  increaseBalance,
  findOneById,
  pushTransactionIds,
  getSavings
}
