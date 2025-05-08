import Joi from 'joi'
import { SYSTEM_TASK_TYPE } from '~/utils/constants'

// Định nghĩa Collection (name & schema)
const SYSTEM_TASK_COLLECTION_NAME = 'system_tasks'
const SYSTEM_TASK_COLLECTION_SCHEMA = Joi.object({
  type: Joi.string().valid(...Object.values(SYSTEM_TASK_TYPE)).required(),
  data: Joi.object().required(),
  scheduleTime: Joi.date().iso().required(),
  repeat: Joi.boolean().default(false),
  status: Joi.string().required(),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await SYSTEM_TASK_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

export const systemTaskModel = {
  SYSTEM_TASK_COLLECTION_NAME,
  SYSTEM_TASK_COLLECTION_SCHEMA
}
