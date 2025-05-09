/* eslint-disable no-useless-catch */
import { StatusCodes } from 'http-status-codes'
import { accumulationModel } from '~/models/accumulationModel'
import { expenseModel } from '~/models/expenseModel'
import { savingsAccountModel } from '~/models/savingsAccountModel'
import { accountModel } from '~/models/accountModel'
import ApiError from '~/utils/ApiError'
import { MONEY_SOURCE_TYPE } from '~/utils/constants'

const createNew = async (amount, dataDetail, { session }) => {
  const moneySourceModelHandle = {
    [MONEY_SOURCE_TYPE.ACCOUNT]: accountModel,
    [MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT]: savingsAccountModel,
    [MONEY_SOURCE_TYPE.ACCUMULATION]: accumulationModel
  }
  try {
    const createdExpense = await expenseModel.createNew(dataDetail, { session })

    const moneySourceModelHandler = moneySourceModelHandle[dataDetail.moneyFromType]
    const accountId = dataDetail.moneyFromId

    // kiểm tra các id có tồn tại ko
    const moneySource = await moneySourceModelHandler.findOneById(accountId)
    if (!moneySource) throw new ApiError(StatusCodes.NOT_FOUND, 'tài khoản nguồn tiền không tồn tại!')

    await moneySourceModelHandler.decreaseBalance(accountId, amount, { session })

    return createdExpense
  } catch (error) {
    throw error
  }
}

export const expenseService = {
  createNew
}
