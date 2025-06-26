/* eslint-disable no-useless-catch */
import { StatusCodes } from 'http-status-codes'
import { accumulationModel } from '~/models/accumulationModel'
import { savingsAccountModel } from '~/models/savingsAccountModel'
import { accountModel } from '~/models/accountModel'
import ApiError from '~/utils/ApiError'
import { MONEY_SOURCE_TYPE } from '~/utils/constants'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'
import { transactionModel } from '~/models/transactionModel'
import { ObjectId } from 'mongodb'
import { repaymentModel } from '~/models/repaymentModel'
import { agenda } from '~/agenda/agenda'

const createNew = async (userId, amount, dataDetail, images, { session }) => {
  const moneySourceModelHandle = {
    [MONEY_SOURCE_TYPE.ACCOUNT]: accountModel,
    [MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT]: savingsAccountModel,
    [MONEY_SOURCE_TYPE.ACCUMULATION]: accumulationModel
  }
  try {
    // kiểm tra khoản vay có tồn tại không
    const borrowingTransaction = await transactionModel.findOneById(new ObjectId(dataDetail?.borrowingTransactionId), { session })
    if (!borrowingTransaction) throw new ApiError(StatusCodes.NOT_FOUND, 'Khoản vay không tồn tại')

    // kiểm tra người dùng có quyền truy cập khoản vay không
    if (!(new ObjectId(userId).equals(new ObjectId(borrowingTransaction?.ownerId)))) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Bạn không có quyền truy cập khoản nợ này!')
    }

    // kiểm tra khoản vay đã được trả chưa
    const repaymentTransaction = await repaymentModel.findOneByBorrowingTransactionId(dataDetail?.borrowingTransactionId, { session })
    if (repaymentTransaction) throw new ApiError(StatusCodes.CONFLICT, 'Khoản vay này đã hoàn thành!')

    // Tiến hành service cho việc trả nợ
    const moneySourceModelHandler = moneySourceModelHandle[dataDetail.moneyFromType]
    const accountId = dataDetail.moneyFromId
    // kiểm tra các id có tồn tại ko
    const moneyFrom = await moneySourceModelHandler.findOneById(accountId, { session })
    if (!moneyFrom) throw new ApiError(StatusCodes.NOT_FOUND, 'tài khoản nguồn tiền trả nợ không tồn tại!')
    else if (moneyFrom?.isBlock == true) throw new ApiError(StatusCodes.CONFLICT, 'tài khoản nguồn tiền trả nợđang bị khóa!')
    // kiểm tra số dư
    if (Number(moneyFrom.balance) < Number(amount)) {
      throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Số dư trong tài khoản không đủ!')
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

    const createdRepayment = await repaymentModel.createNew(dataDetail, { session })
    const getNewRepayment = await repaymentModel.findOneById(createdRepayment.insertedId, { session })

    if (getNewRepayment) {
      await moneySourceModelHandler.decreaseBalance(accountId, Number(amount), { session })

      // hủy lịch nhắc trả nợ
      await agenda.cancel({
        borrowingTransactionId: new ObjectId(getNewRepayment?.borrowingTransactionId)
      })
    }

    return createdRepayment
  } catch (error) {
    throw error
  }
}

export const repaymentService = {
  createNew
}
