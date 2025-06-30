import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { OWNER_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'
import { transactionModel } from './transactionModel'

// Định nghĩa Collection (name & schema)
const BUDGET_COLLECTION_NAME = 'budgets'
const BUDGET_COLLECTION_SCHEMA = Joi.object({
  ownerType: Joi.string().valid(...Object.values(OWNER_TYPE)).required(),
  ownerId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().required(),
  categories: Joi.array().min(1).items(
    Joi.object({
      categoryId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
      categoryName: Joi.string().required(),
      childrenIds: Joi.array().items(
        Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
      ).default([]),
      parentIds: Joi.array().items(
        Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
      ).default([]),
      amount: Joi.number().integer().min(0).required(),
      repeat: Joi.boolean().required(),
      transactionIds: Joi.array().items(
        Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
      ).default([])
    })
  ),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
}).custom((obj, helpers) => {
  if (obj.startTime > obj.endTime) {
    return helpers.message('Thời gian bắt đầu không thể ở sau thời gian kết thúc')
  }
  return obj
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'ownerType', 'ownerId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await BUDGET_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const createNew = async (data, options = {}) => {
  try {
    const validData = await validateBeforeCreate(data)
    const createdBudget = GET_DB().collection(BUDGET_COLLECTION_NAME).insertOne({
      ...validData,
      ownerId: new ObjectId(validData.ownerId),
      categories: data.categories.map(cat => ({
        ...cat,
        categoryId: new ObjectId(cat.categoryId),
        ...(cat.childrenIds && { childrenIds: cat.childrenIds.map(id => new ObjectId(id)) }),
        ...(cat.parentIds && { parentIds: cat.parentIds.map(id => new ObjectId(id)) }),
        transactionIds: cat.transactionIds.map(id => new ObjectId(id))
      }))
    }, options)

    return createdBudget
  } catch (error) { throw new Error(error) }
}

const findOneById = async (budgetId, options = {}) => {
  try {
    const result = await GET_DB().collection(BUDGET_COLLECTION_NAME).findOne({ _id: new ObjectId(String(budgetId)) }, options)
    return result
  } catch (error) { throw new Error(error) }
}

const findOneByTimeRange = async (filterTimeRange, options = {}) => {
  try {
    const result = await GET_DB().collection(BUDGET_COLLECTION_NAME).findOne(filterTimeRange, options)
    return result
  } catch (error) { throw new Error(error) }
}

const pushCategory = async (budgetId, category, options = {}) => {
  try {
    const result = await GET_DB().collection(BUDGET_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(String(budgetId)) },
      { $push: { categories: category } },
      { returnDocument: 'after', ...options }
    )

    return result
  } catch (error) { throw new Error(error) }
}

const getIndividualBudgets = async (filter, options = {}) => {
  try {
    const result = await GET_DB().collection(BUDGET_COLLECTION_NAME).aggregate([
      { $match: filter },
      { $unwind: '$categories' },
      { $lookup: {
        from: transactionModel.TRANSACTION_COLLECTION_NAME,
        let: { ids: '$categories.transactionIds' },
        pipeline: [
          { $match: { $expr: { $in: ['$_id', '$$ids'] } } } // Match các transaction có _id nằm trong ids
        ],
        as: 'transactions'
      } },
      // Tính tổng amount trong transactions và gán vào spent
      {
        $addFields: {
          'categories.spent': {
            $sum: '$transactions.amount'
          }
        }
      },
      // Bỏ trường transactions
      {
        $project: {
          transactions: 0
        }
      },
      {
        $group: {
          _id: '$_id',
          ownerType: { $first: '$ownerType' },
          ownerId: { $first: '$ownerId' },
          categories: { $push: '$categories' },
          startTime: { $first: '$startTime' },
          endTime: { $first: '$endTime' },
          createdAt: { $first: '$createdAt' },
          updatedAt: { $first: '$updatedAt' },
          _destroy: { $first: '$_destroy' }
        }
      }
    ], options).toArray()

    return result
  } catch (error) { throw new Error(error)}
}

const getFamilyBudgets = async (filter, options = {}) => {
  try {
    const result = await GET_DB().collection(BUDGET_COLLECTION_NAME).aggregate([
      { $match: filter },
      { $unwind: '$categories' },
      { $lookup: {
        from: transactionModel.TRANSACTION_COLLECTION_NAME,
        let: { ids: '$categories.transactionIds' },
        pipeline: [
          { $match: { $expr: { $in: ['$_id', '$$ids'] } } } // Match các transaction có _id nằm trong ids
        ],
        as: 'transactionDetails'
      } },
      // Tính tổng amount trong transactionDetails và gán vào spent
      {
        $addFields: {
          'categories.spent': {
            $sum: '$transactionDetails.amount'
          }
        }
      },
      // Bỏ trường transactionDetails
      {
        $project: {
          transactionDetails: 0
        }
      },
      {
        $group: {
          _id: '$_id',
          ownerType: { $first: '$ownerType' },
          ownerId: { $first: '$ownerId' },
          categories: { $push: '$categories' },
          startTime: { $first: '$startTime' },
          endTime: { $first: '$endTime' },
          createdAt: { $first: '$createdAt' },
          updatedAt: { $first: '$updatedAt' },
          _destroy: { $first: '$_destroy' }
        }
      }
    ], options).toArray()

    return result
  } catch (error) { throw new Error(error)}
}

const pushTransactionToBudgets = async (transaction, options = {}) => {
  try {
    const result = await GET_DB().collection(BUDGET_COLLECTION_NAME).updateMany(
      {
        startTime: { $lte: new Date(transaction.transactionTime) },
        endTime: { $gte: new Date(transaction.transactionTime) },
        'categories.categoryId': transaction.categoryId
      },
      {
        $push: {
          'categories.$[category].transactionIds': transaction._id
        },
        $set: {
          updatedAt: Date.now()
        }
      },
      {
        arrayFilters: [
          { 'category.categoryId': transaction.categoryId }
        ],
        ...options
      }
    )
    return result
  } catch (error) { throw new Error(error)}
}

export const budgetModel = {
  BUDGET_COLLECTION_NAME,
  BUDGET_COLLECTION_SCHEMA,
  createNew,
  findOneById,
  findOneByTimeRange,
  pushCategory,
  getIndividualBudgets,
  getFamilyBudgets,
  pushTransactionToBudgets
}
