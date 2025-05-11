import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { OWNER_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const BUDGET_COLLECTION_NAME = 'budgets'
const BUDGET_COLLECTION_SCHEMA = Joi.object({
  ownerType: Joi.string().valid(...Object.values(OWNER_TYPE)).required(),
  ownerId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  categoryId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  amount: Joi.number().integer().min(0).required(),
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().required(),
  repeat: Joi.boolean().required(),
  transactionIds: Joi.array().items(
    Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  ).default([]),

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
      categoryId: new ObjectId(validData.categoryId)
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

const initTransactionIds = async (budgetId, transactionIds, options = {}) => {
  try {
    const result = await GET_DB().collection(BUDGET_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(String(budgetId)) },
      {
        $addToSet: {
          transactionIds: {
            $each: transactionIds
          }
        }
      },
      { returnDocument: 'after', ...options }
    )

    return result
  } catch (error) { throw new Error(error) }
}

export const budgetModel = {
  BUDGET_COLLECTION_NAME,
  BUDGET_COLLECTION_SCHEMA,
  createNew,
  findOneById,
  initTransactionIds
}
