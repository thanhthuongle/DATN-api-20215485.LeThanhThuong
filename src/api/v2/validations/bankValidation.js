import Joi from 'joi'

export const getBankByIdValidation = Joi.object({
  publicId: Joi.string().uuid().required()
})

export default { getBankByIdValidation }
