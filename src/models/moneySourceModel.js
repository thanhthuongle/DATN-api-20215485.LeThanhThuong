import Joi, { options } from 'joi'
import { filter } from 'lodash'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { OWNER_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const MONEY_SOURCE_COLLECTION_NAME = 'money_sources'
const MONEY_SOURCE_COLLECTION_SCHEMA = Joi.object({
  ownerType: Joi.string().valid(...Object.values(OWNER_TYPE)).required(),
  ownerId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  accountIds: Joi.array().items(
    Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  ).default([]),
  savings_accountIds: Joi.array().items(
    Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  ).default([]),
  accumulationIds: Joi.array().items(
    Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  ).default([]),

  // totalBalance: Joi.number().integer(),
  // netBalance: Joi.number().integer(),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'ownerType', 'ownerId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await MONEY_SOURCE_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const createNew = async (data, options = {}) => {
  try {
    const validData = await validateBeforeCreate(data)
    const createdMoneySource = await GET_DB().collection(MONEY_SOURCE_COLLECTION_NAME).insertOne({
      ...validData,
      ownerId: new ObjectId(validData.ownerId)
    }, options)

    return createdMoneySource
  } catch (error) { throw new Error(error) }
}

const findOneById = async (moneySourceId, options = {}) => {
  try {
    const result = await GET_DB().collection(MONEY_SOURCE_COLLECTION_NAME).findOne({ _id: new ObjectId(moneySourceId) }, options)

    return result
  } catch (error) { throw new Error(error) }
}

const findOneRecord = async (filter, options = {}) => {
  try {
    const result = await GET_DB().collection(MONEY_SOURCE_COLLECTION_NAME).findOne(filter, options)

    return result
  } catch (error) { throw new Error(error) }
}

const pushAccountIds = async (account, options = {}) => {
  try {
    const result = await GET_DB().collection(MONEY_SOURCE_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(String(account.moneySourceId)) },
      { $push: { accountIds: new ObjectId(String(account._id)) } },
      { returnDocument: 'after', ...options }
    )

    return result
  } catch (error) { throw new Error(error) }
}

export const moneySourceModel = {
  MONEY_SOURCE_COLLECTION_NAME,
  MONEY_SOURCE_COLLECTION_SCHEMA,
  createNew,
  findOneById,
  findOneRecord,
  pushAccountIds
}
