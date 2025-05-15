import { StatusCodes } from 'http-status-codes'
import Joi from 'joi'
import ApiError from '~/utils/ApiError'

const createNew = async (req, res, next) => {
  const CorrectCondition = Joi.object({
    name: Joi.string().required().min(3).max(60).trim().strict()
  })

  try {
    await CorrectCondition.validateAsync(req.body, { abortEarly: false })

    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

export const contactValidation = {
  createNew
}
