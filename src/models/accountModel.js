import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { ACCOUNT_TYPES, OWNER_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const ACCOUNT_COLLECTION_NAME = 'accounts'
const ACCOUNT_COLLECTION_SCHEMA = Joi.object({
  ownerType: Joi.string().valid(...Object.values(OWNER_TYPE)).required(),
  ownerId: Joi.string().optional().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  moneySourceId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  type: Joi.string().valid(...Object.values(ACCOUNT_TYPES)).required(),
  accountName: Joi.string().required().min(3).max(256).trim(),
  initBalance: Joi.number().integer().required(),
  balance: Joi.number().integer().required(),
  bankId: Joi.string().optional().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  description: Joi.string().optional(),
  icon: Joi.string().default(null),
  isBlock: Joi.boolean().default(false),
  transactionIds: Joi.array().items(
    Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  ).default([]),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'ownerType', 'moneySourceId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await ACCOUNT_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const createNew = async (data, options = {}) => {
  try {
    const validData = await validateBeforeCreate(data)
    const createdAccount = GET_DB().collection(ACCOUNT_COLLECTION_NAME).insertOne({
      ...validData,
      ownerId: new ObjectId(validData.ownerId),
      moneySourceId: new ObjectId(validData.moneySourceId),
      ...(validData.bankId && { bankId: new ObjectId(validData.bankId) })
    }, options)

    return createdAccount
  } catch (error) { throw new Error(error) }
}

const decreaseBalance = async (accountId, amount, options = {}) => {
  try {
    const result = await GET_DB().collection(ACCOUNT_COLLECTION_NAME).findOneAndUpdate(
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
    const result = await GET_DB().collection(ACCOUNT_COLLECTION_NAME).findOneAndUpdate(
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

const findOneById = async (accountId, options = {}) => {
  try {
    const result = await GET_DB().collection(ACCOUNT_COLLECTION_NAME).findOne({ _id: new ObjectId(String(accountId)) }, options)
    return result
  } catch (error) { throw new Error(error) }
}

const getAccounts = async (filter, options = {}) => {
  try {
    const result = await GET_DB().collection(ACCOUNT_COLLECTION_NAME).find(filter, options).toArray()
    return result
  } catch (error) { throw new Error(error) }
}

const pushTransactionIds = async (accountId, transactionId, options = {}) => {
  try {
    const result = await GET_DB().collection(ACCOUNT_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(String(accountId)) },
      { $push: { transactionIds: new ObjectId(String(transactionId)) } },
      { returnDocument: 'after', ...options }
    )

    return result
  } catch (error) { throw new Error(error) }
}

const blockAccount = async (accountId, options = {}) => {
  try {
    const result = await GET_DB().collection(ACCOUNT_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(String(accountId)) },
      { $set: { isBlock: true, updatedAt: Date.now() } },
      { returnDocument: 'after', ...options }
    )

    return result
  } catch (error) { throw new Error(error) }
}

const unblockAccount = async (accountId, options = {}) => {
  try {
    const result = await GET_DB().collection(ACCOUNT_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(String(accountId)) },
      { $set: { isBlock: false, updatedAt: Date.now() } },
      { returnDocument: 'after', ...options }
    )

    return result
  } catch (error) { throw new Error(error) }
}

export const accountModel = {
  ACCOUNT_COLLECTION_NAME,
  ACCOUNT_COLLECTION_SCHEMA,
  createNew,
  decreaseBalance,
  increaseBalance,
  findOneById,
  getAccounts,
  pushTransactionIds,
  blockAccount,
  unblockAccount
}
