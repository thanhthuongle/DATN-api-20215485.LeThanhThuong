import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { OWNER_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'
import { accountModel } from './accountModel'
import { savingsAccountModel } from './savingsAccountModel'
import { accumulationModel } from './accumulationModel'
import { bankModel } from './bankModel'

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

const pushSavingIds = async (account, options = {}) => {
  try {
    const result = await GET_DB().collection(MONEY_SOURCE_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(String(account.moneySourceId)) },
      { $push: { savings_accountIds: new ObjectId(String(account._id)) } },
      { returnDocument: 'after', ...options }
    )

    return result
  } catch (error) { throw new Error(error) }
}

const pushAccumulationIds = async (account, options = {}) => {
  try {
    const result = await GET_DB().collection(MONEY_SOURCE_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(String(account.moneySourceId)) },
      { $push: { accumulationIds: new ObjectId(String(account._id)) } },
      { returnDocument: 'after', ...options }
    )

    return result
  } catch (error) { throw new Error(error) }
}

const getIndividualMoneySource = async (filter, options = {}) => {
  try {
    const result = await GET_DB().collection(MONEY_SOURCE_COLLECTION_NAME).aggregate([
      { $match: filter },
      { $lookup: {
        from: accountModel.ACCOUNT_COLLECTION_NAME,
        let: { accountIds: '$accountIds' },
        pipeline: [
          { $match: { $expr: { $in: ['$_id', '$$accountIds'] } } },
          {
            $lookup: {
              from: bankModel.BANK_COLLECTION_NAME,
              localField: 'bankId',
              foreignField: '_id',
              as: 'bankInfo'
            }
          },
          {
            $unwind: {
              path: '$bankInfo',
              preserveNullAndEmptyArrays: true // vẫn giữ account ngay cả khi không có bank
            }
          },
          { $sort: { createdAt: 1 } }
        ],
        as: 'accounts'
      } },
      { $lookup: {
        from: savingsAccountModel.SAVINGS_ACCOUNT_COLLECTION_NAME,
        let: { savingsIds: '$savings_accountIds' },
        pipeline: [
          { $match: { $expr: { $in: ['$_id', '$$savingsIds'] } } },
          {
            $lookup: {
              from: bankModel.BANK_COLLECTION_NAME,
              localField: 'bankId',
              foreignField: '_id',
              as: 'bankInfo'
            }
          },
          {
            $unwind: {
              path: '$bankInfo',
              preserveNullAndEmptyArrays: true // vẫn giữ account ngay cả khi không có bank
            }
          },
          { $sort: { createdAt: 1 } }
        ],
        as: 'savings_accounts'
      } },
      { $lookup: {
        from: accumulationModel.ACCUMULATION_COLLECTION_NAME,
        let: { accumulationIds: '$accumulationIds' },
        pipeline: [
          { $match: { $expr: { $in: ['$_id', '$$accumulationIds'] } } },
          { $sort: { createdAt: 1 } }
        ],
        as: 'accumulations'
      } }
    ], options).toArray()

    return result[0] || null
  } catch (error) { throw new Error(error) }
}

const getFamilyMoneySource = async (filter, options = {}) => {
  try {
    const result = await GET_DB().collection(MONEY_SOURCE_COLLECTION_NAME).aggregate([
      { $match: filter },
      { $lookup: {
        from: accountModel.ACCOUNT_COLLECTION_NAME,
        localField: 'accountIds',
        foreignField: '_id',
        as: 'accounts'
      } },
      { $lookup: {
        from: savingsAccountModel.SAVINGS_ACCOUNT_COLLECTION_NAME,
        localField: 'savings_accountIds',
        foreignField: '_id',
        as: 'savings_accounts'
      } },
      { $lookup: {
        from: accumulationModel.ACCUMULATION_COLLECTION_NAME,
        localField: 'accumulationIds',
        foreignField: '_id',
        as: 'accumulations'
      } }
    ], options).toArray()

    return result[0] || null
  } catch (error) { throw new Error(error) }
}

export const moneySourceModel = {
  MONEY_SOURCE_COLLECTION_NAME,
  MONEY_SOURCE_COLLECTION_SCHEMA,
  createNew,
  findOneById,
  findOneRecord,
  pushAccountIds,
  pushSavingIds,
  pushAccumulationIds,
  getIndividualMoneySource,
  getFamilyMoneySource
}
