import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const FAMILY_COLLECTION_NAME = 'families'
const FAMILY_COLLECTION_SCHEMA = Joi.object({
  familyName: Joi.string().required().min(3).max(256).trim().strict(),
  backgroundImage: Joi.string().default(null),

  ownerId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  managerIds: Joi.array().items(
    Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  ).default([]),
  memberIds: Joi.array().items(
    Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  ).default([]),


  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'ownerId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await FAMILY_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const createNew = async (data, options = {}) => {
  try {
    const validData = await validateBeforeCreate(data)
    const newFamilyData = {
      ...validData,
      ownerId: new ObjectId(validData.ownerId),
      managerIds: [new ObjectId(validData.ownerId)]
    }
    const createdFamily = await GET_DB().collection(FAMILY_COLLECTION_NAME).insertOne(newFamilyData, options)

    return createdFamily
  } catch (error) { throw new Error(error) }
}

const findOneById = async (familyId, options = {}) => {
  try {
    const result = await GET_DB().collection(FAMILY_COLLECTION_NAME).findOne({ _id: new ObjectId(String(familyId)) }, options)
    return result
  } catch (error) { throw new Error(error) }
}

const findOne = async (filter, options = {}) => {
  try {
    const result = await GET_DB().collection(FAMILY_COLLECTION_NAME).findOne(filter, options)
    return result
  } catch (error) { throw new Error(error) }
}

const update = async (familyId, updateData, options = {}) => {
  try {
    // Lọc field mà không cho phép cập nhật
    Object.keys(updateData).forEach(fieldName => {
      if (INVALID_UPDATE_FIELDS.includes(fieldName)) {
        delete updateData[fieldName]
      }
    })

    const result = await GET_DB().collection (FAMILY_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(String(familyId)) },
      { $set: updateData },
      { returnDocument: 'after', ...options }
    )
    return result
  } catch (error) { throw new Error(error) }
}

const getFamilies = async (userId, options = {}) => {
  try {
    const result = await GET_DB().collection(FAMILY_COLLECTION_NAME).find( { ownerId: new ObjectId(userId) }, options).toArray()

    return result
  } catch (error) { throw new Error(error)}
}

export const familyModel = {
  FAMILY_COLLECTION_NAME,
  FAMILY_COLLECTION_SCHEMA,
  createNew,
  findOneById,
  findOne,
  update,
  getFamilies
}
