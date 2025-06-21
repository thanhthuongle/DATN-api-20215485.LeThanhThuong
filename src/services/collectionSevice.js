/* eslint-disable no-useless-catch */
import { StatusCodes } from 'http-status-codes'
import { accumulationModel } from '~/models/accumulationModel'
import { savingsAccountModel } from '~/models/savingsAccountModel'
import { accountModel } from '~/models/accountModel'
import ApiError from '~/utils/ApiError'
import { MONEY_SOURCE_TYPE } from '~/utils/constants'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'
import { ObjectId } from 'mongodb'
import { collectionModel } from '~/models/collectionModel'
import { transactionModel } from '~/models/transactionModel'
import { agenda } from '~/agenda/agenda'

const createNew = async (userId, amount, dataDetail, images, { session }) => {
  const moneyTargetModelHandle = {
    [MONEY_SOURCE_TYPE.ACCOUNT]: accountModel,
    [MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT]: savingsAccountModel,
    [MONEY_SOURCE_TYPE.ACCUMULATION]: accumulationModel
  }
  try {
    // kiểm tra khoản vay có tồn tại không
    const loanTransaction = await transactionModel.findOneById(new ObjectId(dataDetail?.loanTransactionId), { session })
    if (!loanTransaction) throw new ApiError(StatusCodes.NOT_FOUND, 'Khoản vay không tồn tại')

    // kiểm tra người dùng có quyền truy cập khoản vay không
    if (!(new ObjectId(userId).equals(new ObjectId(loanTransaction?.ownerId)))) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Bạn không có quyền truy cập khoản nợ này!')
    }

    // kiểm tra khoản vay đã được trả chưa
    const collectionTransaction = await collectionModel.findOneByLoanTransactionId(dataDetail.loanTransactionId, { session })
    if (collectionTransaction) throw new ApiError(StatusCodes.CONFLICT, 'Khoản vay này đã hoàn thành!')

    // Tiến hành service cho việc thu nợ
    const moneyTargetModelHandler = moneyTargetModelHandle[dataDetail.moneyTargetType]
    const accountId = dataDetail.moneyTargetId

    // kiểm tra các id có tồn tại ko
    const moneyTarget = await moneyTargetModelHandler.findOneById(accountId, { session })
    if (!moneyTarget) throw new ApiError(StatusCodes.NOT_FOUND, 'tài khoản nhận tiền không tồn tại!')

    if (Array.isArray(images) && images.length > 0) {
      const uploadPromises = images.map(image =>
        CloudinaryProvider.streamUpload(image.buffer, 'transactionImages')
      )

      const uploadResults = await Promise.all(uploadPromises)

      const imageUrls = uploadResults.map(result => result.secure_url)

      // thêm url vào data
      dataDetail.images = imageUrls
    }

    const createdCollection = await collectionModel.createNew(dataDetail, { session })
    const getNewCollection = await collectionModel.findOneById(createdCollection.insertedId, { session })

    if (getNewCollection) {
      await moneyTargetModelHandler.increaseBalance(accountId, Number(amount), { session })

      // Hủy lời nhắc nhở
      await agenda.cancel({
        loanTransactionId: new ObjectId(getNewCollection?.loanTransactionId)
      })
    }

    return createdCollection
  } catch (error) {
    throw error
  }
}

export const collectionService = {
  createNew
}
