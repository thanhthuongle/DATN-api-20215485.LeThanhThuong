/* eslint-disable no-useless-catch */
import { StatusCodes } from 'http-status-codes'
import { accumulationModel } from '~/models/accumulationModel'
import { contributionModel } from '~/models/contributionModel'
import { contributionRequestModel } from '~/models/contributionRequestModel'
import { familyModel } from '~/models/familyModel'
import { savingsAccountModel } from '~/models/savingsAccountModel'
import { walletModel } from '~/models/walletModel'
import ApiError from '~/utils/ApiError'
import { MONEY_SOURCE_TYPE } from '~/utils/constants'

const createNew = async (amount, dataDetail, { session }) => {
  const accountModelHandle = {
    [MONEY_SOURCE_TYPE.WALLET]: walletModel,
    [MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT]: savingsAccountModel,
    [MONEY_SOURCE_TYPE.ACCUMULATION]: accumulationModel
  }
  try {
    const createdContribution = await contributionModel.createNew(dataDetail, { session })

    const moneyFromModelHandler = accountModelHandle[dataDetail.moneyFromType]
    const accountFromId = dataDetail.moneyFromId
    const moneyTargetModelHandler = accountModelHandle[dataDetail.moneyTargetType]
    const accountTargetId = dataDetail.moneyTargetId
    const recipientId = dataDetail.recipientId
    const contributionRequestId = dataDetail.contributionRequestId ? dataDetail.contributionRequestId : null

    // kiểm tra các id có tồn tại ko
    const moneySource = await moneyFromModelHandler.findOneById(accountFromId)
    if (!moneySource) throw new ApiError(StatusCodes.NOT_FOUND, 'Tài khoản nguồn tiền không tồn tại!')
    const moneyTarget = await moneyTargetModelHandler.findOneById(accountTargetId)
    if (!moneyTarget) throw new ApiError(StatusCodes.NOT_FOUND, 'Tài khoản nhận tiền không tồn tại!')
    const recipient = await familyModel.findOneById(recipientId)
    if (!recipient) throw new ApiError(StatusCodes.NOT_FOUND, 'Gia đình nhận tiền không tồn tại!')
    if (contributionRequestId) {
      const contributionRequest = await contributionRequestModel.findOneById(contributionRequestId)
      if (!contributionRequest) throw new ApiError(StatusCodes.NOT_FOUND, 'Yêu cầu đóng góp không tồn tại!')
    }

    await moneyFromModelHandler.decreaseBalance(accountFromId, amount, { session })
    await moneyTargetModelHandler.increaseBalance(accountTargetId, amount, { session })

    return createdContribution
  } catch (error) {
    throw error
  }
}

export const contributionService = {
  createNew
}

