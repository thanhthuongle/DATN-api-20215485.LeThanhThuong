/* eslint-disable no-useless-catch */
import { StatusCodes } from 'http-status-codes'
import { accumulationModel } from '~/models/accumulationModel'
import { savingsAccountModel } from '~/models/savingsAccountModel'
import { transferModel } from '~/models/transferModel'
import { accountModel } from '~/models/accountModel'
import ApiError from '~/utils/ApiError'
import { MONEY_SOURCE_TYPE } from '~/utils/constants'

const createNew = async (amount, dataDetail, { session }) => {
  const accountModelHandle = {
    [MONEY_SOURCE_TYPE.ACCOUNT]: accountModel,
    [MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT]: savingsAccountModel,
    [MONEY_SOURCE_TYPE.ACCUMULATION]: accumulationModel
  }
  try {
    const createdTransfer = await transferModel.createNew(dataDetail, { session })

    const moneyFromModelHandler = accountModelHandle[dataDetail.moneyFromType]
    const accountFromId = dataDetail.moneyFromId
    const moneyTargetModelHandler = accountModelHandle[dataDetail.moneyTargetType]
    const accountTargetId = dataDetail.moneyTargetId

    // kiểm tra các id có tồn tại ko
    const moneySource = await moneyFromModelHandler.findOneById(accountFromId)
    if (!moneySource) throw new ApiError(StatusCodes.NOT_FOUND, 'tài khoản nguồn tiền không tồn tại!')
    const moneyTarget = await moneyTargetModelHandler.findOneById(accountTargetId)
    if (!moneyTarget) throw new ApiError(StatusCodes.NOT_FOUND, 'tài khoản nhận tiền không tồn tại!')

    await moneyFromModelHandler.decreaseBalance(accountFromId, amount, { session })
    await moneyTargetModelHandler.increaseBalance(accountTargetId, amount, { session })

    return createdTransfer
  } catch (error) {
    throw error
  }
}

export const transferService = {
  createNew
}
