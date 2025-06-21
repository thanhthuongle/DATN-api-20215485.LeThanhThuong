/* eslint-disable no-useless-catch */
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { MongoClientInstance } from '~/config/mongodb'
import { accountModel } from '~/models/accountModel'
import { accumulationModel } from '~/models/accumulationModel'
import { categoryModel } from '~/models/categoryModel'
import { moneySourceModel } from '~/models/moneySourceModel'
import { savingsAccountModel } from '~/models/savingsAccountModel'
import ApiError from '~/utils/ApiError'
import { AGENDA_NOTIFICATION_TYPES, MONEY_SOURCE_TYPE, OWNER_TYPE, TRANSACTION_TYPES } from '~/utils/constants'
import { commitWithRetry, runTransactionWithRetry } from '~/utils/mongoTransaction'
import { transactionService } from './transactionService'
import { agenda } from '~/agenda/agenda'
import moment from 'moment'

const createIndividualAccumulation = async (userId, reqBody) => {
  const session = MongoClientInstance.startSession()
  try {
    const result = await runTransactionWithRetry(async (session) => {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary'
      })
      const filter = {
        ownerType: OWNER_TYPE.INDIVIDUAL,
        ownerId: new ObjectId(userId),
        _destroy: false
      }
      let moneySource = await moneySourceModel.findOneRecord(filter, { session })
      if (!moneySource) {
        const newMoneySource = {
          ownerType: OWNER_TYPE.INDIVIDUAL,
          ownerId: userId
        }
        const createdMoneySource = await moneySourceModel.createNew(newMoneySource, { session })
        moneySource = await moneySourceModel.findOneById(createdMoneySource.insertedId, { session })
      }

      const data = {
        ownerType: OWNER_TYPE.INDIVIDUAL,
        ownerId: userId,
        moneySourceId: (moneySource._id).toString(),
        ...reqBody
      }

      const createdAccumulation = await accumulationModel.createNew(data, { session })
      const getNewAccumulation = await accumulationModel.findOneById(createdAccumulation.insertedId, { session })

      if (getNewAccumulation) {
        await moneySourceModel.pushAccumulationIds(getNewAccumulation, { session })

        // tạo lịch nhắc nhở người dùng khi đến hạn kết thúc tích lũy
        await agenda.schedule(moment(getNewAccumulation?.endDate).set({ hour: 10, minute: 0, second: 0, millisecond: 0 }).toISOString(), 'send_reminder', {
          jobType: AGENDA_NOTIFICATION_TYPES.NOTICE,
          userId: new ObjectId(userId),
          accumulationId: getNewAccumulation._id,
          title: 'Kết thúc tích lũy',
          message: `Khoản tích lũy <strong>${getNewAccumulation?.accumulationName}</strong> đã đến thời điểm kết thúc dự kiến.`
        })
      }

      await commitWithRetry(session)
      return getNewAccumulation
    }, MongoClientInstance, session)

    return result
  } catch (error) {
    if (session.inTransaction()) { await session.abortTransaction().catch(() => {}) }
    throw error
  } finally {
    await session.endSession()
  }
}

const createFamilyAccumulation = async (familyId, reqBody) => {
  const session = MongoClientInstance.startSession()
  try {
    const result = await runTransactionWithRetry(async (session) => {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary'
      })
      const filter = {
        ownerType: OWNER_TYPE.FAMILY,
        ownerId: new ObjectId(familyId),
        _destroy: false
      }
      let moneySource = await moneySourceModel.findOneRecord(filter, { session })
      if (!moneySource) {
        const newMoneySource = {
          ownerType: OWNER_TYPE.FAMILY,
          ownerId: familyId
        }
        const createdMoneySource = await moneySourceModel.createNew(newMoneySource, { session })
        moneySource = await moneySourceModel.findOneById(createdMoneySource.insertedId, { session })
      }

      const data = {
        ownerType: OWNER_TYPE.FAMILY,
        ownerId: familyId,
        moneySourceId: (moneySource._id).toString(),
        ...reqBody
      }

      const createdAccumulation = await accumulationModel.createNew(data, { session })
      const getNewAccumulation = await accumulationModel.findOneById(createdAccumulation.insertedId, { session })

      if (getNewAccumulation) {
        await moneySourceModel.pushAccumulationIds(getNewAccumulation, { session })
      }

      await commitWithRetry(session)
      return getNewAccumulation
    }, MongoClientInstance, session)

    return result
  } catch (error) {
    if (session.inTransaction()) { await session.abortTransaction().catch(() => {}) }
    throw error
  } finally {
    await session.endSession()
  }
}

const getIndividualAccumulations = async (userId) => {
  try {
    const filter = {}
    filter.ownerType = OWNER_TYPE.INDIVIDUAL
    filter.ownerId = new ObjectId(userId)
    filter._destroy = false

    const result = await accumulationModel.getAccumulations(filter)

    return result
  } catch (error) { throw error }
}

const finishIndividualAccumulation = async (userId, accumulationId, reqBody) => {
  const moneyTargetModelHandle = {
    [MONEY_SOURCE_TYPE.ACCOUNT]: accountModel,
    [MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT]: savingsAccountModel,
    [MONEY_SOURCE_TYPE.ACCUMULATION]: accumulationModel
  }
  try {
    // Kiểm tra khoản tích lũy tồn tại hay ko
    const accumulation = await accumulationModel.findOneById(accumulationId)
    if (!accumulation) throw new ApiError(StatusCodes.NOT_FOUND, 'Khoản tích lũy không tồn tại')

    // kiểm tra quyền truy cập
    if (!(new ObjectId(userId).equals(new ObjectId(accumulation?.ownerId)))) throw new ApiError(StatusCodes.FORBIDDEN, 'Không có quyền truy cập khoản tích lũy này!')

    // kiểm tra trạng thái cảu khoản tích lũy
    if (accumulation?.isFinish == true) throw new ApiError(StatusCodes.CONFLICT, 'Khoản tích lũy đã kết thúc!')

    // Thực hiện kết thúc khoản tích lũy theo điều kiện số dư
    if (Number(accumulation?.balance) > 0) {
      if (!reqBody?.moneyTargetId || !reqBody?.moneyTargetType) throw new ApiError(StatusCodes.BAD_REQUEST, 'Cần thông tin nơi nhận tiền thừa khi đóng khoản tích lũy!')

      // Kiểm tra nơi nhận tiền thừa từ khoản tích lũy
      const moneyTargetModelHandler = moneyTargetModelHandle[reqBody?.moneyTargetType]
      const moneyTargetId = reqBody?.moneyTargetId
      const moneyTarget = await moneyTargetModelHandler.findOneById(moneyTargetId)
      if (!moneyTarget) throw new ApiError(StatusCodes.NOT_FOUND, 'Tài khoản nhận tiền không tồn tại!')

      const transferCategoryFilter = {
        ownerType: OWNER_TYPE.INDIVIDUAL,
        ownerId: new ObjectId(userId),
        _destroy: false,
        type: TRANSACTION_TYPES.TRANSFER
      }
      const transferCategory = await categoryModel.findOneCategory(transferCategoryFilter)

      const newTransferTransaction = {
        type: TRANSACTION_TYPES.TRANSFER,
        categoryId: (transferCategory._id).toString(),
        name: transferCategory.name,
        description: `Chuyển khoản từ khoản tích lũy: ${accumulation.accumulationName}`,
        amount: accumulation.balance,
        transactionTime: new Date().toISOString(),
        detailInfo: {
          moneyFromType: MONEY_SOURCE_TYPE.ACCUMULATION,
          moneyFromId: accumulationId,
          moneyTargetType: MONEY_SOURCE_TYPE.ACCOUNT,
          moneyTargetId: moneyTargetId
        }
      }
      await transactionService.createIndividualTransaction(userId, newTransferTransaction, [])
    }

    const result = await accumulationModel.finishAccumulation(new ObjectId(accumulation._id))
    if (result?.isFinish == true) {
      await agenda.cancel({
        'data.accumulationId': result._id
      })
    }

    return result
  } catch (error) { throw error }
}

export const accumulationService = {
  createIndividualAccumulation,
  createFamilyAccumulation,
  getIndividualAccumulations,
  finishIndividualAccumulation
}