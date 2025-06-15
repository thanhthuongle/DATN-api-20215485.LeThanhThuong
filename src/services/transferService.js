/* eslint-disable no-useless-catch */
import { StatusCodes } from 'http-status-codes'
import { accumulationModel } from '~/models/accumulationModel'
import { savingsAccountModel } from '~/models/savingsAccountModel'
import { transferModel } from '~/models/transferModel'
import { accountModel } from '~/models/accountModel'
import ApiError from '~/utils/ApiError'
import { MONEY_SOURCE_TYPE } from '~/utils/constants'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'

const createNew = async (userId, amount, dataDetail, images, { session }) => {
  const accountModelHandle = {
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
    const moneyFromModelHandler = accountModelHandle[dataDetail.moneyFromType]
    const accountFromId = dataDetail.moneyFromId
    const moneyTargetModelHandler = accountModelHandle[dataDetail.moneyTargetType]
    const accountTargetId = dataDetail.moneyTargetId

    // kiểm tra các id có tồn tại ko
    const moneySource = await moneyFromModelHandler.findOneById(accountFromId, { session })
    if (!moneySource) throw new ApiError(StatusCodes.NOT_FOUND, 'tài khoản nguồn tiền không tồn tại!')
    const moneyTarget = await moneyTargetModelHandler.findOneById(accountTargetId, { session })
    if (!moneyTarget) throw new ApiError(StatusCodes.NOT_FOUND, 'tài khoản nhận tiền không tồn tại!')
    if (moneySource.balance < amount) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Không đủ số dư')
    }

    const createdTransfer = await transferModel.createNew(dataDetail, { session })
    await moneyFromModelHandler.decreaseBalance(accountFromId, Number(amount), { session })
    await moneyTargetModelHandler.increaseBalance(accountTargetId, Number(amount), { session })

    return createdTransfer
  } catch (error) {
    throw error
  }
}

export const transferService = {
  createNew
}
