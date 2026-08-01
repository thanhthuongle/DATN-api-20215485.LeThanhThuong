import Joi from 'joi'
import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError'

const healthQuerySchema = Joi.object({}).unknown(false)

export const validateHealthQuery = (req, res, next) => {
  const { error } = healthQuerySchema.validate(req.query)

  if (error) {
    return next(new ApiError(StatusCodes.BAD_REQUEST, error.message))
  }

  next()
}
