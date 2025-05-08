/* eslint-disable no-useless-catch */
import { StatusCodes } from 'http-status-codes'
import { accumulationModel } from '~/models/accumulationModel'
import { contactModel } from '~/models/contactModel'
import { loanModel } from '~/models/loanModel'
import { savingsAccountModel } from '~/models/savingsAccountModel'
import { walletModel } from '~/models/walletModel'
import ApiError from '~/utils/ApiError'
import { MONEY_SOURCE_TYPE } from '~/utils/constants'

const createNew = async (amount, dataDetail, { session }) => {
  const moneySourceModelHandle = {
    [MONEY_SOURCE_TYPE.WALLET]: walletModel,
    [MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT]: savingsAccountModel,
    [MONEY_SOURCE_TYPE.ACCUMULATION]: accumulationModel
  }
  try {
    const createdLoan = await loanModel.createNew(dataDetail, { session })

    const moneySourceModelHandler = moneySourceModelHandle[dataDetail.moneyFromType]
    const accountId = dataDetail.moneyFromId
    const borrowerId = dataDetail.borrowerId

    // kiểm tra các id có tồn tại ko
    const moneySource = await moneySourceModelHandler.findOneById(accountId)
    if (!moneySource) throw new ApiError(StatusCodes.NOT_FOUND, 'tài khoản nguồn tiền không tồn tại!')
    const borrower = await contactModel.findOneById(borrowerId)
    if (!borrower) throw new ApiError(StatusCodes.NOT_FOUND, 'Người vay không tồn tại!')

    await moneySourceModelHandler.decreaseBalance(accountId, amount, { session })

    return createdLoan
  } catch (error) {
    throw error
  }
}

export const loanService = {
  createNew
}
