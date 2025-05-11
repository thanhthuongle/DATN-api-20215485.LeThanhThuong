import Joi from 'joi'
import { MONEY_SOURCE_TYPE, OWNER_TYPE, TRANSACTION_TYPES } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'
import { GET_DB } from '~/config/mongodb'
import { ObjectId } from 'mongodb'

// Định nghĩa Collection (name & schema)
const TRANSACTION_COLLECTION_NAME = 'transactions'
const TRANSACTION_COLLECTION_SCHEMA = Joi.object({
  ownerType: Joi.string().valid(...Object.values(OWNER_TYPE)).required(),
  ownerId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  responsiblePersonId: Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE).required(), // user: người thực hiện hoặc phê duyệt
  proposalId: Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE).optional().default(null),

  type: Joi.string().valid(...Object.values(TRANSACTION_TYPES)).required(),
  categoryId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  name: Joi.string().required().min(3).max(256).trim().strict(),
  description: Joi.string().min(3).max(256).trim().strict().optional(),
  amount: Joi.number().integer().min(0).required(),
  transactionTime: Joi.date().iso().required(),

  moneyFromType: Joi.string().valid(...Object.values(MONEY_SOURCE_TYPE)).optional(),
  moneyFromId: Joi.string().optional().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  moneyTargetType: Joi.string().valid(...Object.values(MONEY_SOURCE_TYPE)).optional(),
  moneyTargetId: Joi.string().optional().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'ownerType', 'ownerId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await TRANSACTION_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const createNew = async (data, options = {}) => {
  try {
    const validData = await validateBeforeCreate(data)
    const createdTransaction = await GET_DB().collection(TRANSACTION_COLLECTION_NAME).insertOne({
      ...validData,
      ownerId: new ObjectId(String(validData.ownerId)),
      proposalId: validData.proposalId ? new ObjectId(validData.proposalId) : null,
      responsiblePersonId: new ObjectId(validData.responsiblePersonId),
      categoryId: new ObjectId(String(validData.categoryId)),
      transactionTime: new Date(validData.transactionTime),
      ...(validData.moneyFromId && { moneyFromId: new ObjectId(validData.moneyFromId) }),
      ...(validData.moneyTargetId && { moneyTargetId: new ObjectId(validData.moneyTargetId) })
    }, options)

    return createdTransaction
  } catch (error) { throw new Error(error) }
}

const findOneById = async (transactionId, options = {}) => {
  try {
    const result = await GET_DB().collection(TRANSACTION_COLLECTION_NAME).findOne({ _id: new ObjectId(String(transactionId)) }, options)
    return result
  } catch (error) { throw new Error(error) }
}

const getIndividualTransactions = async (filter, options = {}) => {
  try {

    const result = await GET_DB().collection(TRANSACTION_COLLECTION_NAME).find(filter, options).toArray()

    return result
  } catch (error) { throw new Error(error) }
}

const getFamilyTransactions = async (filter, options = {}) => {
  try {
    const result = await GET_DB().collection(TRANSACTION_COLLECTION_NAME).find(filter, options).toArray()

    return result
  } catch (error) { throw new Error(error) }
}

export const transactionModel = {
  TRANSACTION_COLLECTION_NAME,
  TRANSACTION_COLLECTION_SCHEMA,
  createNew,
  findOneById,
  getIndividualTransactions,
  getFamilyTransactions
}
