import { StatusCodes } from 'http-status-codes'
import Joi from 'joi'
import ApiError from '~/utils/ApiError'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

const createNew = async (req, res, next) => {
  const CorrectCondition = Joi.object({
    categoryId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    amount: Joi.number().integer().min(0).required(),
    startTime: Joi.date().iso().required(),
    endTime: Joi.date().iso().required(),
    repeat: Joi.boolean().required()
  })

  try {
    await CorrectCondition.validateAsync(req.body, { abortEarly: false })

    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

export const budgetValidation = {
  createNew
}
