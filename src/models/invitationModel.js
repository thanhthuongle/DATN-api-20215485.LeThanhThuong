import Joi from 'joi'
import { INVITATION_STATUS } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

// Định nghĩa Collection (name & schema)
const INVITATION_COLLECTION_NAME = 'invitations'
const INVITATION_COLLECTION_SCHEMA = Joi.object({
  inviterId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  inviteeId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  familyId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  status: Joi.string().valid(...Object.values(INVITATION_STATUS)).required(),

  createdAt: Joi.date().timestamp('javascript').default(() => Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
}).custom((obj, helpers) => {
  if (obj.startTime > obj.endTime) {
    return helpers.message('any.invalid', { message: 'startTime cannot be after endTime' })
  }
  return obj
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'inviterId', 'inviteeId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await INVITATION_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

export const userModel = {
  INVITATION_COLLECTION_NAME,
  INVITATION_COLLECTION_SCHEMA
}
