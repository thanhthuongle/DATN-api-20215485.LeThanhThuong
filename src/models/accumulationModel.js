import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { OWNER_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const ACCUMULATION_COLLECTION_NAME = 'accumulations'
const ACCUMULATION_COLLECTION_SCHEMA = Joi.object({
  ownerType: Joi.string().valid(...Object.values(OWNER_TYPE)).required(),
  moneySourceId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  accumulationName: Joi.string().required().min(3).max(256).trim().strict(),
  balance: Joi.number().integer().min(0).default(0),
  targetBalance: Joi.number().integer().min(0).required(),
  startDate: Joi.date().timestamp('javascript').required(),
  endDate: Joi.date().timestamp('javascript').required(),
  isFinish: Joi.boolean().default(false),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
}).custom((obj, helpers) => {
  if (obj.startDate > obj.endDate) {
    return helpers.message('any.invalid', { message: 'startDate cannot be after endDate' })
  }
  return obj
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'ownerType', 'moneySourceId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await ACCUMULATION_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const decreaseBalance = async (accountId, amount, options = {}) => {
  try {
    const result = await GET_DB().collection(ACCUMULATION_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(accountId) },
      {
        $inc: { balance: -amount },
        $set: { updatedAt: Date.now() }
      },
      { returnDocument: 'after' },
      options
    )

    return result
  } catch (error) { throw new Error(error) }
}

const increaseBalance = async (accountId, amount, options = {}) => {
  try {
    const result = await GET_DB().collection(ACCUMULATION_COLLECTION_NAME).findOneAndUpdate(
      { _id: new ObjectId(accountId) },
      {
        $inc: { balance: amount },
        $set: { updatedAt: Date.now() }
      },
      { returnDocument: 'after' },
      options
    )

    return result
  } catch (error) { throw new Error(error) }
}

const findOneById = async (accumulationId) => {
  try {
    const result = await GET_DB().collection(ACCUMULATION_COLLECTION_NAME).findOne({ _id: new ObjectId(String(accumulationId)) })
    return result
  } catch (error) { throw new Error(error) }
}


export const accumulationModel = {
  ACCUMULATION_COLLECTION_NAME,
  ACCUMULATION_COLLECTION_SCHEMA,
  decreaseBalance,
  increaseBalance,
  findOneById
}
