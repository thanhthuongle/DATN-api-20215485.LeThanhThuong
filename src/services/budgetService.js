/* eslint-disable no-useless-catch */
import _ from 'lodash'
import { ObjectId } from 'mongodb'
import { MongoClientInstance } from '~/config/mongodb'
import { budgetModel } from '~/models/budgetModel'
import { transactionModel } from '~/models/transactionModel'
import { OWNER_TYPE } from '~/utils/constants'

const createIndividualBudget = async (userId, reqBody) => {
  const session = MongoClientInstance.startSession()
  try {
    const data = {
      ownerType: OWNER_TYPE.INDIVIDUAL,
      ownerId: userId,
      ...reqBody
    }

    const createdBudget = await budgetModel.createNew(data, { session })
    const getNewBudget = await budgetModel.findOneById(createdBudget.insertedId, { session })

    if (getNewBudget) {
      // Tìm các trasaction thuộc thời gian và hạng mục đã được thực hiện để ghi vào
      const filter = {
        ownerType: OWNER_TYPE.INDIVIDUAL,
        ownerId: new ObjectId(userId),
        categoryId: new ObjectId(getNewBudget.categoryId),
        transactionTime: {
          $gte: getNewBudget.startTime,
          $lte: getNewBudget.endTime
        }
      }
      const transactions = await transactionModel.getIndividualTransactions(filter, { session })
      const transactionIds = []
      _.forEach(transactions, (transaction) => {
        transactionIds.push(new ObjectId(transaction._id))
      })
      await budgetModel.initTransactionIds(createdBudget.insertedId, transactionIds)
      getNewBudget.transactionIds = transactionIds
    }

    return getNewBudget
  } catch (error) {
    if (session.inTransaction()) { await session.abortTransaction().catch(() => {}) }
    throw error
  } finally {
    await session.endSession()
  }
}

const createFamilyBudget = async (familyId, reqBody) => {
  const session = MongoClientInstance.startSession()
  try {

    const data = {
      ownerType: OWNER_TYPE.FAMILY,
      ownerId: familyId,
      ...reqBody
    }

    const createdBudget = await budgetModel.createNew(data, { session })
    const getNewBudget = await budgetModel.findOneById(createdBudget.insertedId, { session })

    if (getNewBudget) {
      // Tìm các trasaction thuộc thời gian và hạng mục đã được thực hiện để ghi vào
      const filter = {
        ownerType: OWNER_TYPE.FAMILY,
        ownerId: new ObjectId(familyId),
        categoryId: new ObjectId(getNewBudget.categoryId),
        transactionTime: {
          $gte: getNewBudget.startTime,
          $lte: getNewBudget.endTime
        }
      }
      const transactions = await transactionModel.getIndividualTransactions(filter, { session })
      const transactionIds = []
      _.forEach(transactions, (transaction) => {
        transactionIds.push(new ObjectId(transaction._id))
      })
      await budgetModel.initTransactionIds(createdBudget.insertedId, transactionIds)
      getNewBudget.transactionIds = transactionIds
    }

    return getNewBudget
  } catch (error) {
    if (session.inTransaction()) { await session.abortTransaction().catch(() => {}) }
    throw error
  } finally {
    await session.endSession()
  }
}

export const budgetService = {
  createIndividualBudget,
  createFamilyBudget
}