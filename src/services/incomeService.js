/* eslint-disable no-useless-catch */
import { StatusCodes } from 'http-status-codes'
import { accumulationModel } from '~/models/accumulationModel'
import { incomeModel } from '~/models/incomeModel'
import { savingsAccountModel } from '~/models/savingsAccountModel'
import { accountModel } from '~/models/accountModel'
import ApiError from '~/utils/ApiError'
import { MONEY_SOURCE_TYPE } from '~/utils/constants'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'

const createNew = async (userId, amount, dataDetail, images, { session }) => {
  const moneyTargetModelHandle = {
    [MONEY_SOURCE_TYPE.ACCOUNT]: accountModel,
    [MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT]: savingsAccountModel,
    [MONEY_SOURCE_TYPE.ACCUMULATION]: accumulationModel
  }
  try {
    if (Array.isArray(images) && images.length > 0) {
      const uploadPromises = images.map(image =>
        CloudinaryProvider.streamUpload(image.buffer, 'transactionImages')
      )

      const uploadResults = await Promise.all(uploadPromises)

      const imageUrls = uploadResults.map(result => result.secure_url)

      // thêm url vào data
      dataDetail.images = imageUrls
    }
    const createdIncome = await incomeModel.createNew(dataDetail, { session })

    const moneyTargetModelHandler = moneyTargetModelHandle[dataDetail.moneyTargetType]
    const accountId = dataDetail.moneyTargetId

    // kiểm tra các id có tồn tại ko
    const moneyTarget = await moneyTargetModelHandler.findOneById(accountId, { session })
    if (!moneyTarget) throw new ApiError(StatusCodes.NOT_FOUND, 'tài khoản nhận tiền không tồn tại!')

    await moneyTargetModelHandler.increaseBalance(accountId, Number(amount), { session })

    return createdIncome
  } catch (error) {
    throw error
  }
}

export const incomeService = {
  createNew
}
