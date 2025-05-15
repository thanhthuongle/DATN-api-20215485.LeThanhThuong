import Joi from 'joi'
import { OWNER_TYPE, PROPOSAL_EXPENSE_STATUS } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const PROPOSAL_EXPENSE_COLLECTION_NAME = 'proposal_expenses'
const PROPOSAL_EXPENSE_COLLECTION_SCHEMA = Joi.object({
  ownerType: Joi.string().valid(...Object.values(OWNER_TYPE)).required(),
  ownerId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  targetId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE), // familyId
  name: Joi.string().required().min(3).max(256).trim().strict(),
  amount: Joi.number().integer().min(0).required(),
  categoryId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  description: Joi.string().min(3).max(256).trim().strict().optional(),
  status: Joi.string().valid(...Object.values(PROPOSAL_EXPENSE_STATUS)).required(),
  images: Joi.array().items(
    Joi.string()
  ).default([]),
  reviewerId: Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE).optional(),
  reviewed_at: Joi.date().iso().optional().default(null),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'ownerType', 'ownerId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await PROPOSAL_EXPENSE_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

export const proposalExpenseModel = {
  PROPOSAL_EXPENSE_COLLECTION_NAME,
  PROPOSAL_EXPENSE_COLLECTION_SCHEMA
}
