/* eslint-disable no-useless-catch */
import { StatusCodes } from 'http-status-codes'
import { accumulationModel } from '~/models/accumulationModel'
import { expenseModel } from '~/models/expenseModel'
import { savingsAccountModel } from '~/models/savingsAccountModel'
import { accountModel } from '~/models/accountModel'
import ApiError from '~/utils/ApiError'
import { MONEY_SOURCE_TYPE } from '~/utils/constants'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'

const createNew = async (userId, amount, dataDetail, images, { session }) => {
  const moneySourceModelHandle = {
    [MONEY_SOURCE_TYPE.ACCOUNT]: accountModel,
    [MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT]: savingsAccountModel,
    [MONEY_SOURCE_TYPE.ACCUMULATION]: accumulationModel
  }
  try {
    const moneySourceModelHandler = moneySourceModelHandle[dataDetail.moneyFromType]
    // kiểm tra các id có tồn tại ko
    const moneyFromId = dataDetail.moneyFromId
    const moneySource = await moneySourceModelHandler.findOneById(moneyFromId, { session })
    if (!moneySource) throw new ApiError(StatusCodes.NOT_FOUND, 'tài khoản nguồn tiền không tồn tại!')
    else if (moneySource?.isBlock == true) throw new ApiError(StatusCodes.CONFLICT, 'Tài khoản sử dụng để chi tiền đang bị khóa.')

    if (Number(moneySource?.balance) < Number(amount)) {
      throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Số dư nguồn tiền không đủ!')
    }

    if (Array.isArray(images) && images.length > 0) {
      const uploadPromises = images.map(image =>
        CloudinaryProvider.streamUpload(image.buffer, 'transactionImages')
      )

      const uploadResults = await Promise.all(uploadPromises)

      const imageUrls = uploadResults.map(result => result.secure_url)

      // thêm url vào data
      dataDetail.images = imageUrls
    }

    const createdExpense = await expenseModel.createNew(dataDetail, { session })

    await moneySourceModelHandler.decreaseBalance(moneyFromId, Number(amount), { session })

    return createdExpense
  } catch (error) {
    throw error
  }
}

export const expenseService = {
  createNew
}
