/* eslint-disable no-useless-catch */
import { StatusCodes } from 'http-status-codes'
import { accumulationModel } from '~/models/accumulationModel'
import { contactModel } from '~/models/contactModel'
import { savingsAccountModel } from '~/models/savingsAccountModel'
import { accountModel } from '~/models/accountModel'
import ApiError from '~/utils/ApiError'
import { AGENDA_NOTIFICATION_TYPES, MONEY_SOURCE_TYPE } from '~/utils/constants'
import { borrowingModel } from '~/models/borrowingModel'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'
import { generateAgendaJobName } from '~/utils/agendaJobNameHelper'
import { ObjectId } from 'mongodb'
import { agenda } from '~/agenda/agenda'

const createNew = async (userId, amount, dataDetail, images, { session }) => {
  const moneyTargetModelHandle = {
    [MONEY_SOURCE_TYPE.ACCOUNT]: accountModel,
    [MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT]: savingsAccountModel,
    [MONEY_SOURCE_TYPE.ACCUMULATION]: accumulationModel
  }
  try {
    const moneyTargetModelHandler = moneyTargetModelHandle[dataDetail.moneyTargetType]
    const accountId = dataDetail.moneyTargetId
    const lenderId = dataDetail.lenderId

    // kiểm tra các id có tồn tại ko
    const moneyTarget = await moneyTargetModelHandler.findOneById(accountId, { session })
    if (!moneyTarget) throw new ApiError(StatusCodes.NOT_FOUND, 'tài khoản nhận tiền không tồn tại!')
    const lender = await contactModel.findOneById(lenderId, { session })
    if (!lender) throw new ApiError(StatusCodes.NOT_FOUND, 'Người cho vay không tồn tại!')

    if (Array.isArray(images) && images.length > 0) {
      const uploadPromises = images.map(image =>
        CloudinaryProvider.streamUpload(image.buffer, 'transactionImages')
      )

      const uploadResults = await Promise.all(uploadPromises)

      const imageUrls = uploadResults.map(result => result.secure_url)

      // thêm url vào data
      dataDetail.images = imageUrls
    }
    const createdBorrowing = await borrowingModel.createNew(dataDetail, { session })

    await moneyTargetModelHandler.increaseBalance(accountId, Number(amount), { session })

    // Tạo lịch nhắc nhở trả nợ nếu có thời gian trả nợ dự kiến
    const getNewBorrowing = await borrowingModel.findOneById(createdBorrowing?.insertedId, { session })
    if (getNewBorrowing?.repaymentTime) {
      const jobName = generateAgendaJobName('send_reminder', AGENDA_NOTIFICATION_TYPES.REPAYMENT, userId)
      const remindData = {
        jobName,
        userId: new ObjectId(userId),
        borrowingTransactionId: new ObjectId(getNewBorrowing?.transactionId),
        title: 'Nhắc trả nợ',
        message: `Bạn có khoản <strong>${amount}&nbsp;₫</strong> vay của <strong>${lender?.name}</strong> đến ngày trả nợ!`
      }
      await agenda.schedule(getNewBorrowing.repaymentTime, 'send_reminder', remindData)
    }

    return getNewBorrowing
  } catch (error) {
    throw error
  }
}

export const borrowingService = {
  createNew
}
