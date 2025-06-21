import { StatusCodes } from 'http-status-codes'
import Joi from 'joi'
import ApiError from '~/utils/ApiError'
import { INTEREST_PAID, MONEY_SOURCE_TYPE, TERM_ENDED } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

const createNew = async (req, res, next) => {
  const CorrectCondition = Joi.object({
    savingsAccountName: Joi.string().required().min(3).max(256).trim(),
    bankId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    initBalance: Joi.number().integer().min(0).required(),
    rate: Joi.number().precision(2).min(0).max(100).required(),
    nonTermRate: Joi.number().precision(2).min(0).max(100).required(),
    startDate: Joi.date().iso().required(),
    term: Joi.number().integer().min(1), // Kỳ hạn: 1m 2m 6m ....: đơn vị tháng
    interestPaid: Joi.string().valid(...Object.values(INTEREST_PAID)).required(), // Thời gian trả lãi
    termEnded: Joi.string().valid(...Object.values(TERM_ENDED)).required(), // hành động khi hết kỳ hạn: ROLL_OVER_PRINCIPAL_AND_INTEREST chỉ tồn tại khi trả lãi vào cuối kỳ
    interestPaidTargetId: Joi.string().optional().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    interestPaidTargetType: Joi.string().valid(MONEY_SOURCE_TYPE.ACCOUNT).optional(),
    description: Joi.string().trim().optional(),
    isClosed: Joi.boolean().optional(),
    isRolledOver: Joi.boolean().optional(),
    parentSavingId: Joi.string().optional().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    moneyFromType: Joi.string().valid(MONEY_SOURCE_TYPE.ACCOUNT).required(),
    moneyFromId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)

  }).custom((value, helpers) => {
    const { interestPaid, termEnded, interestPaidTargetId, interestPaidTargetType } = value

    // 1. Nếu interestPaid !== "maturity", thì không được chọn ROLL_OVER_PRINCIPAL_AND_INTEREST
    if (
      interestPaid !== INTEREST_PAID.MATURITY &&
      termEnded === TERM_ENDED.ROLL_OVER_PRINCIPAL_AND_INTEREST
    ) {
      return helpers.message(
        'Không thể tái tục gốc và lãi khi trả lãi không phải vào cuối kỳ'
      )
    }

    // 2. Nếu interestPaid !== "maturity", thì bắt buộc phải có interestPaidTargetId + Type
    const isInterestTargetRequired = interestPaid !== INTEREST_PAID.MATURITY
    if (isInterestTargetRequired) {
      if (!interestPaidTargetId) {
        return helpers.message('Thông tin tài khoản nhận lãi là bắt buộc')
      }
      if (!interestPaidTargetType) {
        return helpers.message('Thông tin tài khoản nhận lãi là bắt buộc')
      }
    }

    // 3. Nếu interestPaid === "maturity" và teramEnded === "roll_over_principal", thì bắt buộc phải có interestPaidTargetId + Type
    if (interestPaid == INTEREST_PAID.MATURITY && termEnded == TERM_ENDED.ROLL_OVER_PRINCIPAL) {
      if (!interestPaidTargetId) {
        return helpers.message('Thông tin tài khoản nhận lãi là bắt buộc')
      }
      if (!interestPaidTargetType) {
        return helpers.message('Thông tin tài khoản nhận lãi là bắt buộc')
      }
    }

    return value
  })

  try {
    await CorrectCondition.validateAsync(req.body, { abortEarly: false })

    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

export const savingValidation = {
  createNew
}
