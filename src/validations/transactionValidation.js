import Joi from 'joi'
import { OWNER_TYPE, TRANSACTION_TYPES, MONEY_SOURCE_TYPE } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'
import ApiError from '~/utils/ApiError'
import { StatusCodes } from 'http-status-codes'

const createNew = async (req, res, next) => {
  const CorrectCommonCondition = Joi.object({
    // ownerType: Joi.string().valid(...Object.values(OWNER_TYPE)).required(),
    // ownerId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

    responsiblePersonId: Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE).optional(),
    proposalId: Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE).optional(),

    type: Joi.string().valid(...Object.values(TRANSACTION_TYPES)).required(),
    categoryId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    name: Joi.string().required().max(256).trim().strict(),
    description: Joi.string().max(256).trim().strict().optional(),
    amount: Joi.number().integer().min(0).required(),
    transactionTime: Joi.date().iso().required(),

    detailInfo: Joi.object().required()
  }).unknown(false)

  const CorrectExpenseCondition = Joi.object({
    moneyFromType: Joi.string().valid(...Object.values(MONEY_SOURCE_TYPE)).required(),
    moneyFromId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    images: Joi.array().items(
      Joi.string()
    ).optional()
  }).unknown(false)

  const CorrectIncomeCondition = Joi.object({
    moneyTargetType: Joi.string().valid(...Object.values(MONEY_SOURCE_TYPE)).required(),
    moneyTargetId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    images: Joi.array().items(
      Joi.string()
    ).optional()
  }).unknown(false)

  const CorrectLoanCondition = Joi.object({
    moneyFromType: Joi.string().valid(...Object.values(MONEY_SOURCE_TYPE)).required(),
    moneyFromId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    borrowerId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    rate: Joi.number().min(0).max(20).required(),
    collectTime: Joi.date().iso().optional(),
    images: Joi.array().items(
      Joi.string()
    ).optional()
  }).unknown(false)

  const CorrectBorrowingCondition = Joi.object({
    moneyTargetType: Joi.string().valid(...Object.values(MONEY_SOURCE_TYPE)).required(),
    moneyTargetId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    lenderId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    rate: Joi.number().min(0).max(20).required(),
    repaymentTime: Joi.date().iso().optional(),
    images: Joi.array().items(
      Joi.string()
    ).optional()
  }).unknown(false)

  const CorrectTransferCondition = Joi.object({
    moneyFromType: Joi.string().valid(...Object.values(MONEY_SOURCE_TYPE)).required(),
    moneyFromId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    moneyTargetType: Joi.string().valid(...Object.values(MONEY_SOURCE_TYPE)).required(),
    moneyTargetId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    fee: Joi.number().integer().min(0).optional(),
    images: Joi.array().items(
      Joi.string()
    ).optional()
  }).unknown(false)

  const CorrectContributionCondition = Joi.object({
    recipientId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE), // familyID
    moneyFromType: Joi.string().valid(...Object.values(MONEY_SOURCE_TYPE)).required(),
    moneyFromId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    moneyTargetType: Joi.string().valid(...Object.values(MONEY_SOURCE_TYPE)).required(),
    moneyTargetId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    contributionRequestId: Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE).optional(),
    images: Joi.array().items(
      Joi.string()
    ).optional()
  }).unknown(false)

  const CorrectTransactionDetailCondition = {
    [TRANSACTION_TYPES.EXPENSE]: CorrectExpenseCondition,
    [TRANSACTION_TYPES.INCOME]: CorrectIncomeCondition,
    [TRANSACTION_TYPES.LOAN]: CorrectLoanCondition,
    [TRANSACTION_TYPES.BORROWING]: CorrectBorrowingCondition,
    [TRANSACTION_TYPES.TRANSFER]: CorrectTransferCondition,
    [TRANSACTION_TYPES.CONTRIBUTION]: CorrectContributionCondition
  }

  try {
    if (typeof req.body.detailInfo === 'string') req.body.detailInfo = JSON.parse(req.body.detailInfo)
    console.log('req:', req.body)

    await CorrectCommonCondition.validateAsync(req.body, { abortEarly: false })

    await CorrectTransactionDetailCondition[req.body.type].validateAsync(req.body.detailInfo, { abortEarly: false })

    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

export const transactionValidation = {
  createNew
}
