import Joi from 'joi'

// Định nghĩa Collection (name & schema)
const BANK_COLLECTION_NAME = 'banks'
const BANK_COLLECTION_SCHEMA = Joi.object({
  name: Joi.string().required().min(3).max(60).trim().strict(),
  icon: Joi.string().default(null),

  createdAt: Joi.date().timestamp('javascript').default(() => Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await BANK_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

export const userModel = {
  BANK_COLLECTION_NAME,
  BANK_COLLECTION_SCHEMA
}
