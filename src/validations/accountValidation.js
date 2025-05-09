import { StatusCodes } from 'http-status-codes'
import Joi from 'joi'
import ApiError from '~/utils/ApiError'
import { ACCOUNT_TYPES } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

const createNew = async (req, res, next) => {
  const CorrectCondition = Joi.object({
    type: Joi.string().valid(...Object.values(ACCOUNT_TYPES)).required(),
    accountName: Joi.string().required().min(3).max(256).trim().strict(),
    initBalance: Joi.number().integer().required(),
    bankId: Joi.string().optional().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    description: Joi.string().optional(),
    icon: Joi.string().optional()
  })

  try {
    await CorrectCondition.validateAsync(req.body, { abortEarly: false })

    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

export const accountValidation = {
  createNew
}
