/* eslint-disable no-useless-catch */
import { transactionModel } from '~/models/transactionModel'
import { MongoClientInstance } from '~/config/mongodb'
import { commitWithRetry, runTransactionWithRetry } from '~/utils/mongoTransaction'
import { OWNER_TYPE, TRANSACTION_TYPES } from '~/utils/constants'
import { expenseModel } from '~/models/expenseModel'
import { incomeModel } from '~/models/incomeModel'
import { loanModel } from '~/models/loanModel'
import { borrowingModel } from '~/models/borrowingModel'
import { transferModel } from '~/models/transferModel'
import { contributionModel } from '~/models/contributionModel'
import { expenseService } from './expenseService'
import { incomeService } from './incomeService'
import { loanService } from './loanService'
import { borrowingService } from './borrowingService'
import { contributionService } from './contributionService'
import ApiError from '~/utils/ApiError'
import { StatusCodes } from 'http-status-codes'
import { categorieModel } from '~/models/categoryModel'
import { userModel } from '~/models/userModel'
import { familyModel } from '~/models/familyModel'
import { transferService } from './transferService'
import { ObjectId } from 'mongodb'

const transactionTypeModelHandle = {
  [TRANSACTION_TYPES.EXPENSE]: expenseModel,
  [TRANSACTION_TYPES.INCOME]: incomeModel,
  [TRANSACTION_TYPES.LOAN]: loanModel,
  [TRANSACTION_TYPES.BORROWING]: borrowingModel,
  [TRANSACTION_TYPES.TRANSFER]: transferModel,
  [TRANSACTION_TYPES.CONTRIBUTION]: contributionModel
}

const createNew = async (reqBody) => {
  const session = MongoClientInstance.startSession()
  let transactionInsertedId
  const ownerHandle = {
    [OWNER_TYPE.INDIVIDUAL]: userModel,
    [OWNER_TYPE.FAMILY]: familyModel
  }
  const transactionTypeServiceHandle = {
    [TRANSACTION_TYPES.EXPENSE]: expenseService,
    [TRANSACTION_TYPES.INCOME]: incomeService,
    [TRANSACTION_TYPES.LOAN]: loanService,
    [TRANSACTION_TYPES.BORROWING]: borrowingService,
    [TRANSACTION_TYPES.TRANSFER]: transferService,
    [TRANSACTION_TYPES.CONTRIBUTION]: contributionService
  }
  let transactionTypeModelHandler
  let transactionTypeServiceHandler

  try {
    // Xác thực owner và category
    const ownerHandler = ownerHandle[reqBody.ownerType]
    const owner = await ownerHandler.findOneById(reqBody.ownerId)
    if (!owner) throw new ApiError (StatusCodes.NOT_FOUND, 'owner of transaction not found')
    const category = await categorieModel.findOneById(reqBody.categoryId)
    if (!category) throw new ApiError (StatusCodes.NOT_FOUND, 'category of transaction not found')

    await runTransactionWithRetry(async (session) => {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary'
      })

      const { detailInfo, ...commonData } = reqBody

      const createdTransaction = await transactionModel.createNew(commonData, { session })
      transactionInsertedId = createdTransaction.insertedId

      transactionTypeModelHandler = transactionTypeModelHandle[commonData.type]

      transactionTypeServiceHandler = transactionTypeServiceHandle[commonData.type]
      const dataDetail = { transactionId: transactionInsertedId.toString(), ...detailInfo }
      const amount = commonData.amount
      await transactionTypeServiceHandler.createNew(amount, dataDetail, { session })

      await commitWithRetry(session)
    }, MongoClientInstance, session)
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction().catch(() => {})
    }
    throw error
  } finally {
    await session.endSession()
  }

  try {
    const getNewTransaction = await transactionModel.findOneById(transactionInsertedId)
    getNewTransaction.detailInfo = await transactionTypeModelHandler.findOneByTransactionId(transactionInsertedId)

    return getNewTransaction
  } catch (error) {
    throw error
  }
}

const getIndividualTransactions = async (userId, query) => {
  try {
    const filter = {}

    filter.ownerType = OWNER_TYPE.INDIVIDUAL
    filter.ownerId = new ObjectId(userId)
    filter._destroy = false

    if (query.type) filter.type = query.type
    if (query.categoryId) filter.categoryId = new ObjectId(query.categoryId)
    if (query.fromDate || query.toDate) {
      filter.transactionTime = {}
      if (query.fromDate) filter.transactionTime.$gte = new Date(query.fromDate)
      if (query.toDate) filter.transactionTime.$lte = new Date(query.toDate)
    }
    if (query.moneySourceId && query.moneySourceType) { // wallet, savings, accumulation
      filter.$or = [
        { moneyFromType : query.moneySourceType, moneyFromId : new ObjectId(query.moneySourceId) },
        { moneyTargetType: query.moneySourceType, moneyTargetId : new ObjectId(query.moneySourceId) }
      ]
    }
    const result = await transactionModel.getIndividualTransactions(filter)

    return result
  } catch (error) { throw error }
}

const getFamilyTransactions = async (familyId, query) => {
  try {
    const filter = {}

    filter.ownerType = OWNER_TYPE.FAMILY
    filter.ownerId = new ObjectId(familyId)
    filter._destroy = false

    if (query.type) filter.type = query.type
    if (query.categoryId) filter.categoryId = new ObjectId(query.categoryId)
    if (query.fromDate || query.toDate) {
      filter.transactionTime = {}
      if (query.fromDate) filter.transactionTime.$gte = new Date(query.fromDate)
      if (query.toDate) filter.transactionTime.$lte = new Date(query.toDate)
    }
    if (query.moneySourceId && query.moneySourceType) { // wallet, savings, accumulation
      filter.$or = [
        { moneyFromType : query.moneySourceType, moneyFromId : new ObjectId(query.moneySourceId) },
        { moneyTargetType: query.moneySourceType, moneyTargetId : new ObjectId(query.moneySourceId) }
      ]
    }

    const result = await transactionModel.getFamilyTransactions(filter)

    return result
  } catch (error) { throw error }
}

const getDetailIndividualTransaction = async (userId, transactionId) => {
  try {
    if (!ObjectId.isValid(transactionId)) throw new ApiError(StatusCodes.BAD_REQUEST, 'transactionId không hợp lệ!')
    const filter = {}
    filter.ownerType = OWNER_TYPE.INDIVIDUAL
    filter.ownerId = new ObjectId(userId)
    filter._id = new ObjectId(transactionId)
    filter._destroy = false

    let result = await transactionModel.getIndividualTransactions(filter)
    result = result[0]
    // console.log('🚀 ~ getDetailIndividualTransaction ~ result:', result)

    const transactionTypeModelHandler = transactionTypeModelHandle[result?.type]
    if (!transactionTypeModelHandler) {
      throw new ApiError(StatusCodes.BAD_REQUEST, `Transaction type ${result?.type} is not supported.`)
    }
    result.detailInfo = await transactionTypeModelHandler.findOneByTransactionId(transactionId)

    return result
  } catch (error) { throw error }
}

const getDetailFamilyTransaction = async (familyId, transactionId) => {
  try {
    if (!ObjectId.isValid(transactionId)) throw new ApiError(StatusCodes.BAD_REQUEST, 'transactionId không hợp lệ!')

    const filter = {}
    filter.ownerType = OWNER_TYPE.FAMILY
    filter.ownerId = new ObjectId(familyId)
    filter._id = new ObjectId(transactionId)
    filter._destroy = false

    let result = await transactionModel.getFamilyTransactions(filter)
    result = result[0]

    const transactionTypeModelHandler = transactionTypeModelHandle[result?.type]
    if (!transactionTypeModelHandler) {
      throw new ApiError(StatusCodes.BAD_REQUEST, `Transaction type ${result?.type} is not supported.`)
    }
    result.detailInfo = await transactionTypeModelHandler.findOneByTransactionId(transactionId)

    return result
  } catch (error) { throw error }
}

export const transactionService = {
  createNew,
  getIndividualTransactions,
  getFamilyTransactions,
  getDetailIndividualTransaction,
  getDetailFamilyTransaction
}
