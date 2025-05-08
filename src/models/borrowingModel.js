import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { MONEY_SOURCE_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const BORROWING_COLLECTION_NAME = 'borrowings'
const BORROWING_COLLECTION_SCHEMA = Joi.object({
  transactionId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  moneyTargetType: Joi.string().valid(...Object.values(MONEY_SOURCE_TYPE)).required(),
  moneyTargetId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  lenderId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  repaymentTime: Joi.date().iso().optional().default(null),
  image: Joi.array().items(
    Joi.string()
  ).optional().default([]),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'transactionId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await BORROWING_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const createNew = async (data, options = {}) => {
  try {
    const validData = await validateBeforeCreate(data)
    const createdTransaction = await GET_DB().collection(BORROWING_COLLECTION_NAME).insertOne({
      ...validData,
      transactionId: new ObjectId(validData.transactionId),
      moneyTargetId: new ObjectId(validData.moneyTargetId),
      lenderId: new ObjectId(validData.lenderId)
    }, options)

    return createdTransaction
  } catch (error) { throw new Error(error) }
}

const findOneByTransactionId = async (transactionId) => {
  try {
    const result = await GET_DB().collection(BORROWING_COLLECTION_NAME).findOne({ transactionId: new ObjectId(String(transactionId)) })
    return result
  } catch (error) { throw new Error(error) }
}

export const borrowingModel = {
  BORROWING_COLLECTION_NAME,
  BORROWING_COLLECTION_SCHEMA,
  createNew,
  findOneByTransactionId
}
