import Joi from 'joi'
import { MONEY_SOURCE_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'
import { GET_DB } from '~/config/mongodb'
import { ObjectId } from 'mongodb'

// Định nghĩa Collection (name & schema)
const COLLECTION_COLLECTION_NAME = 'collections'
const COLLECTION_COLLECTION_SCHEMA = Joi.object({
  transactionId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  loanTransactionId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  borrowerId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  moneyTargetType: Joi.string().valid(...Object.values(MONEY_SOURCE_TYPE)).required(),
  moneyTargetId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  realCollectTime: Joi.date().iso().required(),
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
  return await COLLECTION_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const createNew = async (data, options = {}) => {
  try {
    const validData = await validateBeforeCreate(data)
    const createdTransaction = await GET_DB().collection(COLLECTION_COLLECTION_NAME).insertOne({
      ...validData,
      transactionId: new ObjectId(validData.transactionId),
      moneyTargetId: new ObjectId(validData.moneyTargetId),
      loanTransactionId: new ObjectId(validData.loanTransactionId)
    }, options)

    return createdTransaction
  } catch (error) { throw new Error(error) }
}

const findOneById = async (collectionId, options = {}) => {
  try {
    const result = await GET_DB().collection(COLLECTION_COLLECTION_NAME).findOne({ _id: new ObjectId(String(collectionId)) }, options)
    return result
  } catch (error) { throw new Error(error) }
}

const findOneByTransactionId = async (transactionId, options = {}) => {
  try {
    const result = await GET_DB().collection(COLLECTION_COLLECTION_NAME).findOne({ transactionId: new ObjectId(String(transactionId)) }, options)
    return result
  } catch (error) { throw new Error(error) }
}

const findOneByLoanTransactionId = async (loanTransactionId, options = {}) => {
  try {
    const result = await GET_DB().collection(COLLECTION_COLLECTION_NAME).findOne({ loanTransactionId: new ObjectId(String(loanTransactionId)) }, options)
    return result
  } catch (error) { throw new Error(error) }
}

const getManyDetailTransactions = async (filter, options = {}) => {
  try {
    const result = await GET_DB().collection(COLLECTION_COLLECTION_NAME).find(filter, options).toArray()
    return result
  } catch (error) { throw new Error(error) }
}

export const collectionModel = {
  COLLECTION_COLLECTION_NAME,
  COLLECTION_COLLECTION_SCHEMA,
  createNew,
  findOneById,
  findOneByTransactionId,
  getManyDetailTransactions,
  findOneByLoanTransactionId
}
