import { StatusCodes } from 'http-status-codes'
import Joi from 'joi'
import ApiError from '~/utils/ApiError'

const createNew = async (req, res, next) => {
  const CorrectCondition = Joi.object({
    accumulationName: Joi.string().required().min(3).max(256).trim().strict(),
    targetBalance: Joi.number().integer().min(0).required(),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required(),
    description: Joi.string().optional()
  }).custom((obj, helpers) => {
    if (obj.startDate > obj.endDate) {
      return helpers.message('Thời gian bắt đầu không thể ở sau thời gian kết thúc')
    }
    return obj
  })

  try {
    await CorrectCondition.validateAsync(req.body, { abortEarly: false })

    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

export const accumulationValidation = {
  createNew
}
