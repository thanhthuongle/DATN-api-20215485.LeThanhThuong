import Joi from 'joi'
import { OWNER_TYPE, MONEY_SOURCE_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const CONTRIBUTION_REQUEST_COLLECTION_NAME = 'contribution_requests'
const CONTRIBUTION_REQUEST_COLLECTION_SCHEMA = Joi.object({
  ownerType: Joi.string().valid(...Object.values(OWNER_TYPE)).required(),
  ownerId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  familyId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  name: Joi.string().required().min(3).max(256).trim().strict(),
  description: Joi.string().required().min(3).max(256).trim().strict(),
  amount: Joi.number().integer().min(0).required(),
  moneyTargetType: Joi.string().valid(...Object.values(MONEY_SOURCE_TYPE)).required(),
  moneyTargetId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  deadline: Joi.date().timestamp('javascript').required(),
  contributerIds: Joi.array().items(
    Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  ).default([]),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'ownerType', 'ownerId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await CONTRIBUTION_REQUEST_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

export const contributionRequestModel = {
  CONTRIBUTION_REQUEST_COLLECTION_NAME,
  CONTRIBUTION_REQUEST_COLLECTION_SCHEMA
}
