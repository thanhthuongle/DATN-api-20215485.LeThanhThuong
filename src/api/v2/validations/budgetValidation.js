import Joi from 'joi'

export const validateBudgetCreation = (req, res, next) => {
  const schema = Joi.object({
    categoryId: Joi.number().integer().positive().required(),
    categoryName: Joi.string().max(256).required(),
    icon: Joi.string().allow('', null),
    amount: Joi.number().integer().min(0).required(),
    repeat: Joi.boolean().default(false),
    startTime: Joi.date().iso().required(),
    endTime: Joi.date().iso().greater(Joi.ref('startTime')).required()
  })

  const { error, value } = schema.validate(req.body, { abortEarly: false })
  if (error) {
    const apiError = new Error(error.details.map((d) => d.message).join(', '))
    apiError.statusCode = 422
    return next(apiError)
  }
  req.body = value
  return next()
}
