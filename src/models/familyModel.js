import Joi from 'joi'
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


  createdAt: Joi.date().timestamp('javascript').default(() => Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'ownerId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await FAMILY_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

export const userModel = {
  FAMILY_COLLECTION_NAME,
  FAMILY_COLLECTION_SCHEMA
}
