/* eslint-disable no-useless-catch */
import { StatusCodes } from 'http-status-codes'
import _ from 'lodash'
import moment from 'moment'
import { ObjectId } from 'mongodb'
import { agenda } from '~/agenda/agenda'
import { MongoClientInstance } from '~/config/mongodb'
import { budgetModel } from '~/models/budgetModel'
import { categoryModel } from '~/models/categoryModel'
import { transactionModel } from '~/models/transactionModel'
import ApiError from '~/utils/ApiError'
import { AGENDA_NOTIFICATION_TYPES, OWNER_TYPE } from '~/utils/constants'
import { commitWithRetry, runTransactionWithRetry } from '~/utils/mongoTransaction'

const createIndividualBudget = async (userId, reqBody) => {
  const session = MongoClientInstance.startSession()
  let remindFlag = false
  let bugdetCategory = null
  try {
    const result = await runTransactionWithRetry(async (session) => {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary'
      })
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
        let totalAmountTransaction = 0
        const transactionIds = []
        _.forEach(transactions, (transaction) => {
          transactionIds.push(transaction._id.toString())
          totalAmountTransaction += Number(transaction?.amount)
        })

        if (Number(totalAmountTransaction) > Number(reqBody?.amount)) remindFlag = true

        const dataCreateNew = {
          ownerType: OWNER_TYPE.INDIVIDUAL,
          ownerId: userId,
          startTime: reqBody.startTime,
          endTime: reqBody.endTime,
          categories: [
            {
              categoryId: reqBody.categoryId,
              categoryName: category.name,
              icon: category?.icon,
              childrenIds: category.childrenIds.map(id => id.toString()),
              parentIds: category.parentIds.map(id => id.toString()),
              amount: reqBody.amount,
              repeat: reqBody.repeat,
              transactionIds
            }
          ]
        }

        bugdetCategory = dataCreateNew.categories[0]

        const createdBudget = await budgetModel.createNew(dataCreateNew, { session })
        const getNewBudget = await budgetModel.findOneById(createdBudget.insertedId, { session })

        await commitWithRetry(session)
        return getNewBudget
      } else {
        _.forEach(budget.categories, (category) => {
          if (category.categoryId == reqBody.categoryId) throw new ApiError(StatusCodes.CONFLICT, 'Ngân sách muốn tạo đã tồn tại!')
        })

        const transactions = await transactionModel.getIndividualTransactions(filterTransaction, { session })
        let totalAmountTransaction = 0
        const transactionIds = []
        _.forEach(transactions, (transaction) => {
          transactionIds.push(transaction._id.toString())
          totalAmountTransaction += Number(transaction?.amount)
        })

        if (Number(totalAmountTransaction) > Number(reqBody?.amount)) remindFlag = true

        const dataPushCaregory = {
          categoryId: new ObjectId(reqBody.categoryId),
          categoryName: category.name,
          icon: category?.icon,
          childrenIds: category.childrenIds,
          parentIds: category.parentIds,
          amount: reqBody.amount,
          repeat: reqBody.repeat,
          transactionIds
        }

        bugdetCategory = dataPushCaregory

        await budgetModel.pushCategory(budget._id, dataPushCaregory, { session })
        budget.categories.push(dataPushCaregory)

        await commitWithRetry(session)
        return budget
      }
    }, MongoClientInstance, session)

    return result
  } catch (error) {
    if (session.inTransaction()) { await session.abortTransaction().catch(() => {}) }
    throw error
  } finally {
    await session.endSession()
    if (remindFlag) { // Cần tạo nhắc nhở đã tiêu quá giới hạn
      const remindData = {
        jobType: AGENDA_NOTIFICATION_TYPES.NOTICE,
        userId: new ObjectId(userId),
        title: 'Vượt ngân sách',
        message: `Bạn đã tiêu vượt ngân sách (từ ${moment(reqBody?.startTime).format('L')} đến ${moment(reqBody?.endTime).format('L')}) cho hạng mục "${bugdetCategory?.categoryName}".`
      }
      await agenda.now('send_reminder', remindData)
    }
  }
}

const createFamilyBudget = async (familyId, reqBody) => {
  const session = MongoClientInstance.startSession()
  try {
    const result = await runTransactionWithRetry(async (session) => {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary'
      })
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
              categoryName: category.name,
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

        await commitWithRetry(session)
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
          categoryName: category.name,
          childrenIds: category.childrenIds,
          parentIds: category.parentIds,
          amount: reqBody.amount,
          repeat: reqBody.repeat,
          transactionIds
        }

        await budgetModel.pushCategory(budget._id, dataPushCaregory, { session })
        budget.categories.push(dataPushCaregory)

        await commitWithRetry(session)
        return budget
      }
    }, MongoClientInstance, session)

    return result
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

    return budgets
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

    return budgets
  } catch (error) { throw error}
}

const checkAndNotifyOverLimitBudget = async (userId, categoryId, newAmount, options = {}) => {
  const externalSession = options.session
  const session = externalSession || MongoClientInstance.startSession()
  try {
    const result = await runTransactionWithRetry(async (session) => {
      // Nếu dùng session bên ngoài thì không nên gọi startTransaction nữa!
      if (!externalSession) {
        session.startTransaction({
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
          readPreference: 'primary'
        })
      }

      // Kiểm tra categoryId
      const category = await categoryModel.findOneById(categoryId, { session })
      if (!category || category?.ownerId?.toString() != userId?.toString()) throw new ApiError(StatusCodes.BAD_REQUEST, 'Hạng mục kiểm tra ngân sách không hợp lệ')

      const activeBudgetsfilter = {
        ownerType: OWNER_TYPE.INDIVIDUAL,
        ownerId: new ObjectId(userId),
        startTime: { $lte: new Date() },
        endTime: { $gte: new Date() },
        _destroy: false
      }
      const activeBudgets = await budgetModel.getIndividualBudgets(activeBudgetsfilter, { session })
      for (const budget of activeBudgets) {
        for (const cat of budget.categories) {
          const matchByDirectId = cat.categoryId.toString() === categoryId.toString()
          if (matchByDirectId) {
            // 3. Lấy các giao dịch đã chi tiêu trong ngân sách
            const transactions = await transactionModel.getIndividualTransactions({
              _id: { $in: cat.transactionIds }
            }, { session })
            const totalSpent = transactions.reduce((sum, t) => sum + Number(t.amount), 0)
            const newTotal = totalSpent + Number(newAmount)
            const budgetLimit = Number(cat.amount)

            if (newTotal > budgetLimit) { // Thông báo cho người dùng là đã vượt quá ngân sách
              const remindData = {
                jobType: AGENDA_NOTIFICATION_TYPES.NOTICE,
                userId: new ObjectId(userId),
                title: 'Vượt ngân sách',
                message: `Bạn đã tiêu vượt ngân sách (từ <strong>${moment(budget?.startTime).format('DD/MM/YYYY')}</strong> đến <strong>${moment(budget?.endTime).format('DD/MM/YYYY')}</strong>) cho hạng mục <strong>"${category?.name}"</strong>.`
              }
              await agenda.now('send_reminder', remindData)
            }
          }
        }
      }

      if (!externalSession) await commitWithRetry(session)
    }, MongoClientInstance, session)

    return result
  } catch (error) {
    if (!externalSession && session.inTransaction()) {
      await session.abortTransaction().catch(() => {})
    }
    throw error
  } finally {
    if (!externalSession) {
      await session.endSession()
    }
  }
}

export const budgetService = {
  createIndividualBudget,
  createFamilyBudget,
  getIndividualBudgets,
  getFamilyBudgets,
  checkAndNotifyOverLimitBudget
}
