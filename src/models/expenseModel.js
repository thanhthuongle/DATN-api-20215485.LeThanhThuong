import Joi from 'joi'
import { MONEY_SOURCE_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'
import { GET_DB } from '~/config/mongodb'
import { ObjectId } from 'mongodb'

// Định nghĩa Collection (name & schema)
const EXPENSE_COLLECTION_NAME = 'expenses'
const EXPENSE_COLLECTION_SCHEMA = Joi.object({
  transactionId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  moneyFromType: Joi.string().valid(...Object.values(MONEY_SOURCE_TYPE)).required(),
  moneyFromId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  images: Joi.array().items(
    Joi.string()
  ).default([]),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'transactionId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await EXPENSE_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const createNew = async (data, options = {}) => {
  try {
    const validData = await validateBeforeCreate(data)
    const createdTransaction = await GET_DB().collection(EXPENSE_COLLECTION_NAME).insertOne({
      ...validData,
      transactionId: new ObjectId(validData.transactionId),
      moneyFromId: new ObjectId(validData.moneyFromId)
    }, options)

    return createdTransaction
  } catch (error) { throw new Error(error) }
}

const findOneByTransactionId = async (transactionId, options = {}) => {
  try {
    const result = await GET_DB().collection(EXPENSE_COLLECTION_NAME).findOne({ transactionId: new ObjectId(String(transactionId)) }, options)
    return result
  } catch (error) { throw new Error(error) }
}

const getManyDetailTransactions = async (filter, options = {}) => {
  try {
    const result = await GET_DB().collection(EXPENSE_COLLECTION_NAME).find(filter, options).toArray()
    return result
  } catch (error) { throw new Error(error) }
}

export const expenseModel = {
  EXPENSE_COLLECTION_NAME,
  EXPENSE_COLLECTION_SCHEMA,
  createNew,
  findOneByTransactionId,
  getManyDetailTransactions
}
