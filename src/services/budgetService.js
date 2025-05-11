/* eslint-disable no-useless-catch */
import { StatusCodes } from 'http-status-codes'
import _ from 'lodash'
import { ObjectId } from 'mongodb'
import { MongoClientInstance } from '~/config/mongodb'
import { budgetModel } from '~/models/budgetModel'
import { categoryModel } from '~/models/categoryModel'
import { transactionModel } from '~/models/transactionModel'
import ApiError from '~/utils/ApiError'
import { OWNER_TYPE } from '~/utils/constants'

function transformCategories(categories) {
  const categoryMap = new Map()
  const result = []

  // B1: Tạo Map từ categoryId → category
  categories.forEach(cat => {
    categoryMap.set(cat.categoryId.toString(), { ...cat }) // clone tránh ảnh hưởng gốc
  })

  const processed = new Set()

  // B2: Duyệt tất cả categories
  for (const cat of categories) {
    // Nếu là parent
    if (cat.childrenIds && cat.childrenIds.length > 0) {
      const subCategories = []

      for (const childId of cat.childrenIds) {
        if (categoryMap.has(childId.toString())) {
          subCategories.push(categoryMap.get(childId.toString()))
          processed.add(childId.toString()) // đánh dấu đã xử lý (xoá khỏi root sau)
        }
      }

      const newCat = {
        ...cat,
        subCategories
      }

      // Xoá fields không cần
      delete newCat.childrenIds
      delete newCat.parentIds

      result.push(newCat)
      processed.add(cat.categoryId.toString())
    } else if (!processed.has(cat.categoryId.toString())) {
      // Nếu không là con & chưa bị xử lý thì giữ lại
      const newCat = { ...cat }
      delete newCat.childrenIds
      delete newCat.parentIds
      result.push(newCat)
    }
  }

  return result
}

const createIndividualBudget = async (userId, reqBody) => {
  const session = MongoClientInstance.startSession()
  try {
    const filterTimeRange = {
      ownerType: OWNER_TYPE.INDIVIDUAL,
      ownerId: new ObjectId(userId),
      startTime: new Date(reqBody.startTime),
      endTime: new Date(reqBody.endTime),
      _destroy: false
    }
    const budget = await budgetModel.findOneByTimeRange(filterTimeRange, { session })

    const filterCategory = {
      ownerType: OWNER_TYPE.INDIVIDUAL,
      ownerId: new ObjectId(userId),
      _id: new ObjectId(reqBody.categoryId),
      _destroy: false
    }
    const category = await categoryModel.findOneCategory(filterCategory, { session })
    if (!category) throw new ApiError(StatusCodes.BAD_REQUEST, 'Hạng mục tạo ngân sách không tồn tại')

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
            childrenIds: category.childrenIds.map(id => id.toString()),
            parentIds: category.parentIds.map(id => id.toString()),
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
        if (category.categoryId == reqBody.categoryId) throw new ApiError(StatusCodes.CONFLICT, 'Ngân sách muốn tạo đã tồn tại!')
      })

      const transactions = await transactionModel.getIndividualTransactions(filterTransaction, { session })
      const transactionIds = []
      _.forEach(transactions, (transaction) => {
        transactionIds.push(transaction._id.toString())
      })

      const dataPushCaregory = {
        categoryId: new ObjectId(reqBody.categoryId),
        childrenIds: category.childrenIds,
        parentIds: category.parentIds,
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
      endTime: new Date(reqBody.endTime),
      _destroy: false
    }
    const budget = await budgetModel.findOneByTimeRange(filterTimeRange, { session })

    const filterCategory = {
      ownerType: OWNER_TYPE.FAMILY,
      ownerId: new ObjectId(familyId),
      _id: new ObjectId(reqBody.categoryId),
      _destroy: false
    }
    const category = await categoryModel.findOneCategory(filterCategory, { session })
    if (!category) throw new ApiError(StatusCodes.BAD_REQUEST, 'Hạng mục tạo ngân sách không tồn tại')

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
            childrenIds: category.childrenIds.map(id => id.toString()),
            parentIds: category.parentIds.map(id => id.toString()),
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
        if (category.categoryId == reqBody.categoryId) throw new ApiError(StatusCodes.CONFLICT, 'Ngân sách muốn tạo đã tồn tại!')
      })

      const transactions = await transactionModel.getFamilyTransactions(filterTransaction, { session })
      const transactionIds = []
      _.forEach(transactions, (transaction) => {
        transactionIds.push(transaction._id.toString())
      })

      const dataPushCaregory = {
        categoryId: reqBody.categoryId,
        childrenIds: category.childrenIds,
        parentIds: category.parentIds,
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

const getIndividualBudgets = async (userId, isFinish) => {
  try {
    const filter = {
      ownerType: OWNER_TYPE.INDIVIDUAL,
      ownerId: new ObjectId(userId),
      _destroy: false
    }

    if (isFinish == false) { // Các budget chưa kết thúc tức endTime >= now
      filter.endTime = { $gte: new Date() }
    } else filter.endTime = { $lt: new Date() } // Các budget đã kết thúc tức endTime < now

    const budgets = await budgetModel.getIndividualBudgets(filter)

    const transformedBudgets = _.map(budgets, (budget) => ({
      ...budget,
      categories: transformCategories(budget.categories)
    }))

    return transformedBudgets
  } catch (error) { throw error}
}

const getFamilyBudgets = async (familyId, isFinish) => {
  try {
    const filter = {
      ownerType: OWNER_TYPE.FAMILY,
      ownerId: new ObjectId(familyId),
      _destroy: false
    }

    if (isFinish == false) { // Các budget chưa kết thúc tức endTime >= now
      filter.endTime = { $gte: new Date() }
    } else filter.endTime = { $lt: new Date() } // Các budget đã kết thúc tức endTime < now

    const budgets = await budgetModel.getFamilyBudgets(filter)

    const transformedBudgets = _.map(budgets, (budget) => ({
      ...budget,
      categories: transformCategories(budget.categories)
    }))

    return transformedBudgets
  } catch (error) { throw error}
}

export const budgetService = {
  createIndividualBudget,
  createFamilyBudget,
  getIndividualBudgets,
  getFamilyBudgets
}