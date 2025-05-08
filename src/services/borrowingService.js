/* eslint-disable no-useless-catch */
import { StatusCodes } from 'http-status-codes'
import { accumulationModel } from '~/models/accumulationModel'
import { contactModel } from '~/models/contactModel'
import { incomeModel } from '~/models/incomeModel'
import { savingsAccountModel } from '~/models/savingsAccountModel'
import { walletModel } from '~/models/walletModel'
import ApiError from '~/utils/ApiError'
import { MONEY_SOURCE_TYPE } from '~/utils/constants'

const createNew = async (amount, dataDetail, { session }) => {
  const moneyTargetModelHandle = {
    [MONEY_SOURCE_TYPE.WALLET]: walletModel,
    [MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT]: savingsAccountModel,
    [MONEY_SOURCE_TYPE.ACCUMULATION]: accumulationModel
  }
  try {
    const createdIncome = await incomeModel.createNew(dataDetail, { session })

    const moneyTargetModelHandler = moneyTargetModelHandle[dataDetail.moneyTargetType]
    const accountId = dataDetail.moneyTargetId
    const lenderId = dataDetail.lenderId

    // kiểm tra các id có tồn tại ko
    const moneyTarget = await moneyTargetModelHandler.findOneById(accountId)
    if (!moneyTarget) throw new ApiError(StatusCodes.NOT_FOUND, 'tài khoản nhận tiền không tồn tại!')
    const lender = await contactModel.findOneById(lenderId)
    if (!lender) throw new ApiError(StatusCodes.NOT_FOUND, 'Người cho vay không tồn tại!')

    await moneyTargetModelHandler.increaseBalance(accountId, amount, { session })

    return createdIncome
  } catch (error) {
    throw error
  }
}

export const borrowingService = {
  createNew
}
