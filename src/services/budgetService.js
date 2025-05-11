/* eslint-disable no-useless-catch */
import { StatusCodes } from 'http-status-codes'
import _ from 'lodash'
import { ObjectId } from 'mongodb'
import { MongoClientInstance } from '~/config/mongodb'
import { budgetModel } from '~/models/budgetModel'
import { transactionModel } from '~/models/transactionModel'
import ApiError from '~/utils/ApiError'
import { OWNER_TYPE } from '~/utils/constants'

const createIndividualBudget = async (userId, reqBody) => {
  const session = MongoClientInstance.startSession()
  try {
    const filterTimeRange = {
      ownerType: OWNER_TYPE.INDIVIDUAL,
      ownerId: new ObjectId(userId),
      startTime: new Date(reqBody.startTime),
      endTime: new Date(reqBody.endTime)
    }
    const budget = await budgetModel.findOneByTimeRange(filterTimeRange, { session })

    const filterTransaction = {
      ownerType: OWNER_TYPE.INDIVIDUAL,
      ownerId: new ObjectId(userId),
      categoryId: new ObjectId(reqBody.categoryId),
      transactionTime: {
        $gte: new Date(reqBody.startTime),
        $lte: new Date(reqBody.endTime)
      },
      _destroy: false
    }

    if (!budget) {
      const transactions = await transactionModel.getIndividualTransactions(filterTransaction, { session })
      const transactionIds = []
      _.forEach(transactions, (transaction) => {
        transactionIds.push(transaction._id.toString())
      })

      const dataCreateNew = {
        ownerType: OWNER_TYPE.INDIVIDUAL,
        ownerId: userId,
        startTime: reqBody.startTime,
        endTime: reqBody.endTime,
        categories: [
          {
            categoryId: reqBody.categoryId,
            amount: reqBody.amount,
            repeat: reqBody.repeat,
            transactionIds
          }
        ]
      }

      const createdBudget = await budgetModel.createNew(dataCreateNew, { session })
      const getNewBudget = await budgetModel.findOneById(createdBudget.insertedId, { session })

      return getNewBudget
    } else {
      _.forEach(budget.categories, (category) => {
        if (category.categoryId == reqBody.categoryId) throw new ApiError(StatusCodes.CONFLICT, 'Hạng mục này đã tồn tại ngân sách!')
      })

      const transactions = await transactionModel.getIndividualTransactions(filterTransaction, { session })
      const transactionIds = []
      _.forEach(transactions, (transaction) => {
        transactionIds.push(transaction._id.toString())
      })

      const dataPushCaregory = {
        categoryId: reqBody.categoryId,
        amount: reqBody.amount,
        repeat: reqBody.repeat,
        transactionIds
      }

      await budgetModel.pushCategory(budget._id, dataPushCaregory, { session })
      budget.categories.push(dataPushCaregory)

      return budget
    }
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
    const filterTimeRange = {
      ownerType: OWNER_TYPE.FAMILY,
      ownerId: new ObjectId(familyId),
      startTime: new Date(reqBody.startTime),
      endTime: new Date(reqBody.endTime)
    }
    const budget = await budgetModel.findOneByTimeRange(filterTimeRange, { session })

    const filterTransaction = {
      ownerType: OWNER_TYPE.FAMILY,
      ownerId: new ObjectId(familyId),
      categoryId: new ObjectId(reqBody.categoryId),
      transactionTime: {
        $gte: new Date(reqBody.startTime),
        $lte: new Date(reqBody.endTime)
      },
      _destroy: false
    }

    if (!budget) {
      const transactions = await transactionModel.getFamilyTransactions(filterTransaction, { session })
      const transactionIds = []
      _.forEach(transactions, (transaction) => {
        transactionIds.push(transaction._id.toString())
      })

      const dataCreateNew = {
        ownerType: OWNER_TYPE.FAMILY,
        ownerId: familyId,
        startTime: reqBody.startTime,
        endTime: reqBody.endTime,
        categories: [
          {
            categoryId: reqBody.categoryId,
            amount: reqBody.amount,
            repeat: reqBody.repeat,
            transactionIds
          }
        ]
      }

      const createdBudget = await budgetModel.createNew(dataCreateNew, { session })
      const getNewBudget = await budgetModel.findOneById(createdBudget.insertedId, { session })

      return getNewBudget
    } else {
      _.forEach(budget.categories, (category) => {
        if (category.categoryId == reqBody.categoryId) throw new ApiError(StatusCodes.CONFLICT, 'Hạng mục này đã tồn tại ngân sách!')
      })

      const transactions = await transactionModel.getFamilyTransactions(filterTransaction, { session })
      const transactionIds = []
      _.forEach(transactions, (transaction) => {
        transactionIds.push(transaction._id.toString())
      })

      const dataPushCaregory = {
        categoryId: reqBody.categoryId,
        amount: reqBody.amount,
        repeat: reqBody.repeat,
        transactionIds
      }

      await budgetModel.pushCategory(budget._id, dataPushCaregory, { session })
      budget.categories.push(dataPushCaregory)

      return budget
    }
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