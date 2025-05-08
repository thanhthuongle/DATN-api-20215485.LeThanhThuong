import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { MONEY_SOURCE_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const CONTRIBUTION_COLLECTION_NAME = 'contributions'
const CONTRIBUTION_COLLECTION_SCHEMA = Joi.object({
  transactionId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  recipientId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE), // familyID
  moneyFromType: Joi.string().valid(...Object.values(MONEY_SOURCE_TYPE)).required(),
  moneyFromId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  moneyTargetType: Joi.string().valid(...Object.values(MONEY_SOURCE_TYPE)).required(),
  moneyTargetId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  contributionRequestId: Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE).optional().default(null),
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
  return await CONTRIBUTION_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const createNew = async (data, options = {}) => {
  try {
    const validData = await validateBeforeCreate(data)
    const createdTransaction = await GET_DB().collection(CONTRIBUTION_COLLECTION_NAME).insertOne({
      ...validData,
      transactionId: new ObjectId(validData.transactionId),
      recipientId: new ObjectId(validData.recipientId),
      moneyFromId: new ObjectId(validData.moneyFromId),
      moneyTargetId: new ObjectId(validData.moneyTargetId),
      contributionRequestId: validData.contributionRequestId ? new ObjectId(validData.contributionRequestId) : null
    }, options)

    return createdTransaction
  } catch (error) { throw new Error(error) }
}

const findOneByTransactionId = async (transactionId) => {
  try {
    const result = await GET_DB().collection(CONTRIBUTION_COLLECTION_NAME).findOne({ transactionId: new ObjectId(String(transactionId)) })
    return result
  } catch (error) { throw new Error(error) }
}

export const contributionModel = {
  CONTRIBUTION_COLLECTION_NAME,
  CONTRIBUTION_COLLECTION_SCHEMA,
  createNew,
  findOneByTransactionId
}
