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

export const savingService = {
  createIndividualSaving,
  createFamilySaving
}