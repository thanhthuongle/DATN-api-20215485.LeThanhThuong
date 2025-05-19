import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { MONEY_SOURCE_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'
import { contactModel } from './contactModel'

// Định nghĩa Collection (name & schema)
const LOAN_COLLECTION_NAME = 'loans'
const LOAN_COLLECTION_SCHEMA = Joi.object({
  transactionId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  moneyFromType: Joi.string().valid(...Object.values(MONEY_SOURCE_TYPE)).required(),
  moneyFromId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  borrowerId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  collectTime: Joi.date().iso().optional().default(null),
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
  return await LOAN_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const createNew = async (data, options = {}) => {
  try {
    const validData = await validateBeforeCreate(data)
    const createdTransaction = await GET_DB().collection(LOAN_COLLECTION_NAME).insertOne({
      ...validData,
      transactionId: new ObjectId(validData.transactionId),
      moneyFromId: new ObjectId(validData.moneyFromId),
      borrowerId: new ObjectId(validData.borrowerId)
    }, options)

    return createdTransaction
  } catch (error) { throw new Error(error) }
}

const findOneByTransactionId = async (transactionId) => {
  try {
    const result = await GET_DB().collection(LOAN_COLLECTION_NAME).findOne({ transactionId: new ObjectId(String(transactionId)) })
    return result
  } catch (error) { throw new Error(error) }
}

const getManyDetailTransactions = async (filter, options = {}) => {
  try {
    const result = await GET_DB().collection(LOAN_COLLECTION_NAME).aggregate([
      { $match: filter },
      { $lookup: {
        from: contactModel.CONTACT_COLLECTION_NAME,
        localField: 'borrowerId',
        foreignField: '_id',
        as: 'borrower'
      } },
      { $unwind: { path: '$borrower', preserveNullAndEmptyArrays: true } }
    ], options).toArray()
    return result
  } catch (error) { throw new Error(error) }
}

export const loanModel = {
  LOAN_COLLECTION_NAME,
  LOAN_COLLECTION_SCHEMA,
  createNew,
  findOneByTransactionId,
  getManyDetailTransactions
}
