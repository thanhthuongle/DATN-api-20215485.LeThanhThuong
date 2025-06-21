/* eslint-disable no-useless-catch */
import { StatusCodes } from 'http-status-codes'
import { accumulationModel } from '~/models/accumulationModel'
import { contactModel } from '~/models/contactModel'
import { loanModel } from '~/models/loanModel'
import { savingsAccountModel } from '~/models/savingsAccountModel'
import { accountModel } from '~/models/accountModel'
import ApiError from '~/utils/ApiError'
import { AGENDA_NOTIFICATION_TYPES, MONEY_SOURCE_TYPE } from '~/utils/constants'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'
import { generateAgendaJobName } from '~/utils/agendaJobNameHelper'
import { ObjectId } from 'mongodb'
import { agenda } from '~/agenda/agenda'

const createNew = async (userId, amount, dataDetail, images, { session }) => {
  const moneySourceModelHandle = {
    [MONEY_SOURCE_TYPE.ACCOUNT]: accountModel,
    [MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT]: savingsAccountModel,
    [MONEY_SOURCE_TYPE.ACCUMULATION]: accumulationModel
  }
  try {
    const accountId = dataDetail.moneyFromId
    const account = await accountModel.findOneById(accountId, { session })
    // console.log(account)
    if (account.balance < amount) {
      throw new ApiError(StatusCodes.BAD_REQUEST, `Số dư trong tài khoản ${account.accountName} không đủ!`)
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
    const createdLoan = await loanModel.createNew(dataDetail, { session })

    const moneySourceModelHandler = moneySourceModelHandle[dataDetail.moneyFromType]
    // const accountId = dataDetail.moneyFromId
    const borrowerId = dataDetail.borrowerId

    // kiểm tra các id có tồn tại ko
    const moneySource = await moneySourceModelHandler.findOneById(accountId, { session })
    if (!moneySource) throw new ApiError(StatusCodes.NOT_FOUND, 'tài khoản nguồn tiền không tồn tại!')
    const borrower = await contactModel.findOneById(borrowerId, { session })
    if (!borrower) throw new ApiError(StatusCodes.NOT_FOUND, 'Người vay không tồn tại!')

    await moneySourceModelHandler.decreaseBalance(accountId, amount, { session })

    // Tạo lịch nhắc thu nợ nếu có thời gian thu nợ dự kiến
    const getNewLoan = await loanModel.findOneById(createdLoan.insertedId, { session })
    if (getNewLoan?.collectTime) {
      const remindData = {
        jobType: AGENDA_NOTIFICATION_TYPES.NOTICE,
        userId: new ObjectId(userId),
        loanTransactionId: new ObjectId(getNewLoan?.transactionId),
        title: 'Nhắc thu nợ',
        message: `Bạn có khoản <strong>${amount}&nbsp;₫</strong> cho <strong>${borrower?.name}</strong> vay đến ngày thu nợ!`
      }
      await agenda.schedule(getNewLoan.collectTime, 'send_reminder', remindData)
    }

    return createdLoan
  } catch (error) {
    throw error
  }
}

export const loanService = {
  createNew
}
