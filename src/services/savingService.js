/* eslint-disable no-useless-catch */
import { ObjectId } from 'mongodb'
import { MongoClientInstance } from '~/config/mongodb'
import { categoryModel } from '~/models/categoryModel'
import { moneySourceModel } from '~/models/moneySourceModel'
import { savingsAccountModel } from '~/models/savingsAccountModel'
import { MONEY_SOURCE_TYPE, OWNER_TYPE, TRANSACTION_TYPES } from '~/utils/constants'
import { commitWithRetry, runTransactionWithRetry } from '~/utils/mongoTransaction'
import { transactionService } from './transactionService'
import { transactionModel } from '~/models/transactionModel'
import { transferModel } from '~/models/transferModel'
import { transferService } from './transferService'
import ApiError from '~/utils/ApiError'
import { StatusCodes } from 'http-status-codes'
import { accountModel } from '~/models/accountModel'

function calcInterest(initBalance, startDate, term, rate = 10, nonTermRate = 10) {
  const now = new Date()
  const start = new Date(startDate)

  // Tính ngày đáo hạn
  const maturityDate = new Date(start)
  maturityDate.setMonth(maturityDate.getMonth() + term)

  const isRegulation = now >= maturityDate
  let interest = 0

  if (isRegulation) {// Tất toán đúng kỳ hạn
    interest = Math.round((initBalance * rate * term) / 1200)
  } else {// Tất toán không kỳ hạn
    const msPerDay = 24 * 60 * 60 * 1000
    const dayOfSavings = Math.floor((now - start) / msPerDay)
    interest = Math.round((initBalance * nonTermRate * dayOfSavings) / 36500)
  }

  return interest
}

const createIndividualSaving = async (userId, reqBody) => {
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
        // balance: reqBody.initBalance,
        balance: 0,
        ...reqBody
      }

      const createdSaving = await savingsAccountModel.createNew(data, { session })
      const getNewSaving = await savingsAccountModel.findOneById(createdSaving.insertedId, { session })

      if (getNewSaving) {
        await moneySourceModel.pushSavingIds(getNewSaving, { session })
        const transferCategory = await categoryModel.findOneCategory({
          ownerType: OWNER_TYPE.INDIVIDUAL,
          ownerId: new ObjectId(userId),
          _destroy: false,
          type: TRANSACTION_TYPES.TRANSFER
        }, { session })

        const newCommonTransactionData = {
          ownerType: OWNER_TYPE.INDIVIDUAL,
          ownerId: userId,
          responsiblePersonId: userId,
          type: TRANSACTION_TYPES.TRANSFER,
          categoryId: transferCategory._id.toString(),
          name: transferCategory.name,
          description: `Mở sổ tiết kiệm: ${getNewSaving.savingsAccountName}`,
          amount: getNewSaving.initBalance,
          transactionTime: getNewSaving.startDate.toISOString()
        }
        const createdTransaction = await transactionModel.createNew(newCommonTransactionData, { session })

        const newDetailInfoTransactionData = {
          transactionId: createdTransaction.insertedId.toString(),
          moneyFromType: MONEY_SOURCE_TYPE.ACCOUNT,
          moneyFromId: getNewSaving.moneyFromId.toString(),
          moneyTargetType: MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT,
          moneyTargetId: getNewSaving._id.toString()
        }
        await transferService.createNew(userId, getNewSaving.initBalance, newDetailInfoTransactionData, [], { session })
        //TODO: Tính toán, lên lịch các tác vụ tự động
      }

      await commitWithRetry(session)
      return getNewSaving
    }, MongoClientInstance, session)

    return result
  } catch (error) {
    if (session.inTransaction()) { await session.abortTransaction().catch(() => {}) }
    throw error
  } finally {
    await session.endSession()
  }
}

const createFamilySaving = async (userId, familyId, reqBody) => {
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
        balance: reqBody.initBalance,
        ...reqBody
      }

      const createdSaving = await savingsAccountModel.createNew(data, { session })
      const getNewSaving = await savingsAccountModel.findOneById(createdSaving.insertedId, { session })

      if (getNewSaving) {
        await moneySourceModel.pushSavingIds(getNewSaving, { session })
        const transferCategory = await categoryModel.findOneCategory({
          ownerType: OWNER_TYPE.FAMILY,
          ownerId: new ObjectId(familyId),
          _destroy: false,
          type: TRANSACTION_TYPES.TRANSFER
        }, { session })

        const newCommonTransactionData = {
          ownerType: OWNER_TYPE.FAMILY,
          ownerId: familyId,
          responsiblePersonId: userId,
          type: TRANSACTION_TYPES.TRANSFER,
          categoryId: transferCategory._id.toString(),
          name: transferCategory.name,
          description: `Mở sổ tiết kiệm: ${getNewSaving.savingsAccountName}`,
          amount: getNewSaving.initBalance,
          transactionTime: getNewSaving.startDate.toISOString()
        }
        const createdTransaction = await transactionModel.createNew(newCommonTransactionData, { session })

        const newDetailInfoTransactionData = {
          transactionId: createdTransaction.insertedId.toString(),
          moneyFromType: MONEY_SOURCE_TYPE.ACCOUNT,
          moneyFromId: getNewSaving.moneyFromId.toString(),
          moneyTargetType: MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT,
          moneyTargetId: getNewSaving._id.toString()
        }
        await transferService.createNew(getNewSaving.initBalance, newDetailInfoTransactionData, [], { session })

        //TODO: Tính toán, lên lịch các tác vụ tự động
      }

      await commitWithRetry(session)
      return getNewSaving
    }, MongoClientInstance, session)

    return result
  } catch (error) {
    if (session.inTransaction()) { await session.abortTransaction().catch(() => {}) }
    throw error
  } finally {
    await session.endSession()
  }
}

const getIndividualSavings = async (userId) => {
  try {
    const filter = {}
    filter.ownerType = OWNER_TYPE.INDIVIDUAL
    filter.ownerId = new ObjectId(userId)
    filter._destroy = false

    const result = await savingsAccountModel.getSavings(filter)

    return result
  } catch (error) { throw error }
}

const closeSaving = async (userId, savingId, reqBody) => {
  const session = MongoClientInstance.startSession()
  try {
    const result = await runTransactionWithRetry(async (session) => {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary'
      })

      // Kiểm tra dữ liệu gửi lên
      //Kiểm tra sổ tiết kiệm
      const savingsAccount = await savingsAccountModel.findOneById(savingId, { session })
      if (!savingsAccount) throw new ApiError(StatusCodes.NOT_FOUND, 'Sổ tiết kiệm không tồn tại!')
      //Kiểm tra thông tin nơi nhận tiền sau tất toán
      let moneyTarget
      if (reqBody?.moneyTargetType == MONEY_SOURCE_TYPE.ACCOUNT) {
        moneyTarget = await accountModel.findOneById(reqBody.moneyTargetId)
      } else if (reqBody?.moneyTargetType == MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT) {
        moneyTarget = await savingsAccountModel.findOneById(reqBody.moneyTargetId)
      } else {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Nơi nhận tiền sau tất toán không hỗ trợ!')
      }
      if (!moneyTarget) throw new ApiError(StatusCodes.NOT_FOUND, 'Nơi nhận tiền không tồn tại!')

      // Tính tiền lãi
      const interest = calcInterest(savingsAccount.initBalance, savingsAccount.startDate, savingsAccount.term, savingsAccount.rate, savingsAccount.nonTermRate)
      // Tăng số dư cho sổ tiết kiệm để phục vụ cho chuyển khoản
      await savingsAccountModel.increaseBalance(savingId, interest, { session })
      // Chuyển tiền về tài khoản nhận
      const transferCategoryFilter = {
        ownerType: OWNER_TYPE.INDIVIDUAL,
        ownerId: new ObjectId(userId),
        type: TRANSACTION_TYPES.TRANSFER,
        _destroy: false
      }
      const transferCategory = await categoryModel.findOneCategory(transferCategoryFilter, { session })
      const transferData = {
        type: TRANSACTION_TYPES.TRANSFER,
        categoryId: transferCategory._id.toString(),
        name: transferCategory.name,
        description: `Tất toán sổ tiết kiệm: ${savingsAccount.savingsAccountName}`,
        amount: Number(savingsAccount.initBalance) + Number(interest),
        transactionTime: new Date(),
        detailInfo: {
          moneyFromType: MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT,
          moneyFromId: savingId,
          moneyTargetType: reqBody.moneyTargetType,
          moneyTargetId: reqBody.moneyTargetId
        }
      }
      await transactionService.createIndividualTransaction(userId, transferData, [], { session })

      // Cập nhật trạng thái và số dư của sổ tiết kiệm
      const updateData = {
        balance: 0,
        isClosed: true
      }
      const savingClosed = await savingsAccountModel.update(savingId, updateData, { session })

      await commitWithRetry(session)
      return savingClosed
    }, MongoClientInstance, session)

    return result
  } catch (error) {
    if (session.inTransaction()) { await session.abortTransaction().catch(() => {}) }
    throw error
  } finally {
    await session.endSession()
  }
}

export const savingService = {
  createIndividualSaving,
  createFamilySaving,
  getIndividualSavings,
  closeSaving
}