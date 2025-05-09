import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { OWNER_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const CONTACT_COLLECTION_NAME = 'contacts'
const CONTACT_COLLECTION_SCHEMA = Joi.object({
  ownerType: Joi.string().valid(...Object.values(OWNER_TYPE)).required(),
  ownerId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  name: Joi.string().required().min(3).max(60).trim().strict(),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'ownerType', 'ownerId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await CONTACT_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const findOneById = async (contactId, options = {}) => {
  try {
    const result = await GET_DB().collection(CONTACT_COLLECTION_NAME).findOne({ _id: new ObjectId(String(contactId)) }, options)
    return result
  } catch (error) { throw new Error(error) }
}

export const contactModel = {
  CONTACT_COLLECTION_NAME,
  CONTACT_COLLECTION_SCHEMA,
  findOneById
}
