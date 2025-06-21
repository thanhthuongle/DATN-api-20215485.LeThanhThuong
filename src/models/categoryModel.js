import Joi, { options } from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { OWNER_TYPE, TRANSACTION_TYPES } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const CATEGORY_COLLECTION_NAME = 'categories'
const CATEGORY_COLLECTION_SCHEMA = Joi.object({
  ownerType: Joi.string().valid(...Object.values(OWNER_TYPE)).required(),
  ownerId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  name: Joi.string().required().min(3).max(256).trim(),
  type: Joi.string().valid(...Object.values(TRANSACTION_TYPES)).required(),
  allowDelete: Joi.boolean().default(false),
  icon: Joi.string().default(null),
  childrenIds: Joi.array().items(
    Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  ).default([]),
  parentIds: Joi.array().items(
    Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  ).default([]),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'ownerType', 'ownerId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await CATEGORY_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const findOneById = async (userId) => {
  try {
    const result = await GET_DB().collection(CATEGORY_COLLECTION_NAME).findOne({ _id: new ObjectId(String(userId)) })
    return result
  } catch (error) { throw new Error(error) }
}

const insertMany = async (data, options = {}) => {
  try {
    const result = await GET_DB().collection(CATEGORY_COLLECTION_NAME).insertMany(data, options)
    return result
  } catch (error) { throw new Error(error) }
}

const getIndividualCategories = async (filter) => {
  try {
    const result = await GET_DB().collection(CATEGORY_COLLECTION_NAME).find(filter).toArray()

    return result
  } catch (error) { throw new Error(error) }
}

const getFamilyCategories = async (filter) => {
  try {
    const result = await GET_DB().collection(CATEGORY_COLLECTION_NAME).find(filter).toArray()

    return result
  } catch (error) { throw new Error(error) }
}

const findOneCategory = async(filter, options = {}) => {
  try {
    const result = await GET_DB().collection(CATEGORY_COLLECTION_NAME).findOne(filter, options)

    return result
  } catch (error) { throw new Error(error)}
}

export const categoryModel = {
  CATEGORY_COLLECTION_NAME,
  CATEGORY_COLLECTION_SCHEMA,
  findOneById,
  insertMany,
  getIndividualCategories,
  getFamilyCategories,
  findOneCategory
}
