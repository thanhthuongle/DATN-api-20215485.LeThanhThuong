/* eslint-disable no-useless-catch */
import { transactionModel } from '~/models/transactionModel'
import { MongoClientInstance } from '~/config/mongodb'
import { commitWithRetry, runTransactionWithRetry } from '~/utils/mongoTransaction'
import { MONEY_SOURCE_TYPE, OWNER_TYPE, TRANSACTION_TYPES } from '~/utils/constants'
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
import { categoryModel } from '~/models/categoryModel'
import { userModel } from '~/models/userModel'
import { familyModel } from '~/models/familyModel'
import { transferService } from './transferService'
import { ObjectId } from 'mongodb'
import { accountModel } from '~/models/accountModel'
import { accumulationModel } from '~/models/accumulationModel'
import { savingsAccountModel } from '~/models/savingsAccountModel'
import { budgetModel } from '~/models/budgetModel'
import { collectionModel } from '~/models/collectionModel'
import { repaymentModel } from '~/models/repaymentModel'
import { collectionService } from './collectionSevice'
import { repaymentService } from './repaymentService'
import { contactModel } from '~/models/contactModel'
import moment from 'moment'
import { budgetService } from './budgetService'

const transactionTypeModelHandle = {
  [TRANSACTION_TYPES.EXPENSE]: expenseModel,
  [TRANSACTION_TYPES.INCOME]: incomeModel,
  [TRANSACTION_TYPES.LOAN]: loanModel,
  [TRANSACTION_TYPES.BORROWING]: borrowingModel,
  [TRANSACTION_TYPES.TRANSFER]: transferModel,
  [TRANSACTION_TYPES.CONTRIBUTION]: contributionModel,
  [TRANSACTION_TYPES.COLLECT]: collectionModel,
  [TRANSACTION_TYPES.REPAYMENT]: repaymentModel
}

const transactionTypeServiceHandle = {
  [TRANSACTION_TYPES.EXPENSE]: expenseService,
  [TRANSACTION_TYPES.INCOME]: incomeService,
  [TRANSACTION_TYPES.LOAN]: loanService,
  [TRANSACTION_TYPES.BORROWING]: borrowingService,
  [TRANSACTION_TYPES.TRANSFER]: transferService,
  [TRANSACTION_TYPES.CONTRIBUTION]: contributionService,
  [TRANSACTION_TYPES.COLLECT]: collectionService,
  [TRANSACTION_TYPES.REPAYMENT]: repaymentService
}

const moneySourceModelHandle = {
  [MONEY_SOURCE_TYPE.ACCOUNT]: accountModel,
  [MONEY_SOURCE_TYPE.ACCUMULATION]: accumulationModel,
  [MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT]: savingsAccountModel
}

const createNew = async (reqBody) => {
  const session = MongoClientInstance.startSession()
  let transactionInsertedId
  const ownerHandle = {
    [OWNER_TYPE.INDIVIDUAL]: userModel,
    [OWNER_TYPE.FAMILY]: familyModel
  }
  let transactionTypeModelHandler
  let transactionTypeServiceHandler

  try {
    // Xác thực owner và category
    const ownerHandler = ownerHandle[reqBody.ownerType]
    const owner = await ownerHandler.findOneById(reqBody.ownerId)
    if (!owner) throw new ApiError (StatusCodes.NOT_FOUND, 'owner of transaction not found')
    const category = await categoryModel.findOneById(reqBody.categoryId)
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

const createIndividualTransaction = async (userId, reqBody, images, options = {}) => {
  const externalSession = options.session
  const session = externalSession || MongoClientInstance.startSession()

  const { detailInfo, ...commonData } = reqBody
  commonData.ownerType = OWNER_TYPE.INDIVIDUAL
  commonData.ownerId = userId
  commonData.responsiblePersonId = userId

  let transactionTypeModelHandler
  let transactionTypeServiceHandler

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
      const category = await categoryModel.findOneById(commonData?.categoryId, { session })
      if (!category || category?.ownerId?.toString() != userId?.toString()) throw new ApiError(StatusCodes.BAD_REQUEST, 'Hạng mục không hợp lệ')
      // Kiểm tra thời gian thực hiện giao dịch
      if (moment(commonData?.transactionTime).isAfter(moment())) throw new ApiError(StatusCodes.BAD_REQUEST, 'Không thể thực hiện giao dịch với thời gian trong tương lai')

      const createdTransaction = await transactionModel.createNew(commonData, { session })

      transactionTypeModelHandler = transactionTypeModelHandle[commonData.type]

      transactionTypeServiceHandler = transactionTypeServiceHandle[commonData.type]
      const dataDetail = { transactionId: createdTransaction.insertedId.toString(), ...detailInfo }
      const amount = commonData.amount
      await transactionTypeServiceHandler.createNew(userId, amount, dataDetail, images, { session })

      const getNewTransaction = await transactionModel.findOneById(createdTransaction.insertedId, { session })
      if (getNewTransaction) {
        getNewTransaction.detailInfo = await transactionTypeModelHandler.findOneByTransactionId(createdTransaction.insertedId, { session })
        switch (getNewTransaction.type) {
        case TRANSACTION_TYPES.EXPENSE: {
          const moneySourceModelHandler = moneySourceModelHandle[detailInfo.moneyFromType]
          await moneySourceModelHandler.pushTransactionIds(detailInfo.moneyFromId, createdTransaction.insertedId, { session })
          await budgetModel.pushTransactionToBudgets(getNewTransaction, { session })
          await budgetService.checkAndNotifyOverLimitBudget(userId, commonData?.categoryId, { session })
          break
        }

        case TRANSACTION_TYPES.INCOME: {
          const moneySourceModelHandler = moneySourceModelHandle[detailInfo.moneyTargetType]
          await moneySourceModelHandler.pushTransactionIds(detailInfo.moneyTargetId, createdTransaction.insertedId, { session })
          break
        }

        case TRANSACTION_TYPES.LOAN: {
          const moneySourceModelHandler = moneySourceModelHandle[detailInfo.moneyFromType]
          await moneySourceModelHandler.pushTransactionIds(detailInfo.moneyFromId, createdTransaction.insertedId, { session })
          break
        }

        case TRANSACTION_TYPES.BORROWING: {
          const moneySourceModelHandler = moneySourceModelHandle[detailInfo.moneyTargetType]
          await moneySourceModelHandler.pushTransactionIds(detailInfo.moneyTargetId, createdTransaction.insertedId, { session })
          break
        }

        case TRANSACTION_TYPES.TRANSFER: {
          const moneySourceModelHandler1 = moneySourceModelHandle[detailInfo.moneyFromType]
          await moneySourceModelHandler1.pushTransactionIds(detailInfo.moneyFromId, createdTransaction.insertedId, { session })
          const moneySourceModelHandler2 = moneySourceModelHandle[detailInfo.moneyTargetType]
          await moneySourceModelHandler2.pushTransactionIds(detailInfo.moneyTargetId, createdTransaction.insertedId, { session })
          break
        }

        case TRANSACTION_TYPES.COLLECT: {
          const moneySourceModelHandler = moneySourceModelHandle[detailInfo.moneyTargetType]
          await moneySourceModelHandler.pushTransactionIds(detailInfo.moneyTargetId, createdTransaction.insertedId, { session })
          break
        }

        case TRANSACTION_TYPES.REPAYMENT: {
          const moneySourceModelHandler = moneySourceModelHandle[detailInfo.moneyFromType]
          await moneySourceModelHandler.pushTransactionIds(detailInfo.moneyFromId, createdTransaction.insertedId, { session })
          break
        }

        }
      }

      if (!externalSession) await commitWithRetry(session)
      return getNewTransaction
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

const createFamilyTransaction = async (userId, familyId, reqBody) => {
  const session = MongoClientInstance.startSession()

  const { detailInfo, ...commonData } = reqBody
  commonData.ownerType = OWNER_TYPE.FAMILY
  commonData.ownerId = familyId
  commonData.responsiblePersonId = userId

  let transactionTypeModelHandler
  let transactionTypeServiceHandler

  try {
    const category = await categoryModel.findOneById(reqBody?.categoryId)
    if (!category) throw new ApiError (StatusCodes.NOT_FOUND, 'category of transaction not found')

    const result = await runTransactionWithRetry(async (session) => {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary'
      })

      const createdTransaction = await transactionModel.createNew(commonData, { session })

      transactionTypeModelHandler = transactionTypeModelHandle[commonData.type]

      transactionTypeServiceHandler = transactionTypeServiceHandle[commonData.type]
      const dataDetail = { transactionId: createdTransaction.insertedId.toString(), ...detailInfo }
      const amount = commonData.amount
      await transactionTypeServiceHandler.createNew(amount, dataDetail, { session })

      const getNewTransaction = await transactionModel.findOneById(createdTransaction.insertedId, { session })
      getNewTransaction.detailInfo = await transactionTypeModelHandler.findOneByTransactionId(createdTransaction.insertedId, { session })

      if (getNewTransaction) {
        getNewTransaction.detailInfo = await transactionTypeModelHandler.findOneByTransactionId(createdTransaction.insertedId, { session })
        switch (getNewTransaction.type) {
        case TRANSACTION_TYPES.EXPENSE: {
          const moneySourceModelHandler = moneySourceModelHandle[getNewTransaction.detailInfo.moneyFromType]
          await moneySourceModelHandler.pushTransactionIds(getNewTransaction.detailInfo.moneyFromId, createdTransaction.insertedId, { session })
          await budgetModel.pushTransactionToBudgets(getNewTransaction, { session })
          break
        }

        case TRANSACTION_TYPES.INCOME: {
          const moneySourceModelHandler = moneySourceModelHandle[getNewTransaction.detailInfo.moneyTargetType]
          await moneySourceModelHandler.pushTransactionIds(getNewTransaction.detailInfo.moneyTargetId, createdTransaction.insertedId, { session })
          break
        }

        case TRANSACTION_TYPES.LOAN: {
          const moneySourceModelHandler = moneySourceModelHandle[getNewTransaction.detailInfo.moneyFromType]
          await moneySourceModelHandler.pushTransactionIds(getNewTransaction.detailInfo.moneyFromId, createdTransaction.insertedId, { session })
          break
        }

        case TRANSACTION_TYPES.BORROWING: {
          const moneySourceModelHandler = moneySourceModelHandle[getNewTransaction.detailInfo.moneyTargetType]
          await moneySourceModelHandler.pushTransactionIds(getNewTransaction.detailInfo.moneyTargetId, createdTransaction.insertedId, { session })
          break
        }

        case TRANSACTION_TYPES.TRANSFER: {
          const moneySourceModelHandler1 = moneySourceModelHandle[getNewTransaction.detailInfo.moneyFromType]
          await moneySourceModelHandler1.pushTransactionIds(getNewTransaction.detailInfo.moneyFromId, createdTransaction.insertedId, { session })
          const moneySourceModelHandler2 = moneySourceModelHandle[getNewTransaction.detailInfo.moneyTargetType]
          await moneySourceModelHandler2.pushTransactionIds(getNewTransaction.detailInfo.moneyTargetId, createdTransaction.insertedId, { session })
          break
        }

        }
      }

      await commitWithRetry(session)
      return getNewTransaction
    }, MongoClientInstance, session)

    return result
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction().catch(() => {})
    }
    throw error
  } finally {
    await session.endSession()
  }
}

const getIndividualTransactions = async (userId, query) => {
  try {
    const filter = {}

    filter.ownerType = OWNER_TYPE.INDIVIDUAL
    filter.ownerId = new ObjectId(userId)
    filter._destroy = false
    if (query) {
      if (query.type) {
        if (Array.isArray(query.type)) { filter.type = { $in: query.type } }
        else { filter.type = query.type }
      }
      if (query.categoryId) filter.categoryId = new ObjectId(query.categoryId)
      if (query.transactionIds) {
        if (Array.isArray(query.transactionIds)) {
          const processedTransactionIds = query.transactionIds.map(transactionId => new ObjectId(transactionId))
          filter._id = { $in: processedTransactionIds }
        }
        else { filter._id = new ObjectId(query.transactionIds) }
      }
      if (query.fromDate || query.toDate) {
        filter.transactionTime = {}
        if (query.fromDate) filter.transactionTime.$gte = new Date(query.fromDate)
        if (query.toDate) filter.transactionTime.$lte = new Date(query.toDate)
      }
      if (query.moneySourceId && query.moneySourceType) { // account, savings, accumulation
        filter.$or = [
          { moneyFromType : query.moneySourceType, moneyFromId : new ObjectId(query.moneySourceId) },
          { moneyTargetType: query.moneySourceType, moneyTargetId : new ObjectId(query.moneySourceId) }
        ]
      }
    }
    const result = await transactionModel.getIndividualTransactions(filter)

    return result
  } catch (error) { throw error }
}

const getFullInfoIndividualTransactions = async (userId, query) => {
  try {
    const filter = {}

    filter.ownerType = OWNER_TYPE.INDIVIDUAL
    filter.ownerId = new ObjectId(userId)
    filter._destroy = false
    if (query) {
      if (query.type) {
        if (Array.isArray(query.type)) { filter.type = { $in: query.type } }
        else { filter.type = query.type }
      }
      if (query.categoryId) filter.categoryId = new ObjectId(query.categoryId)
      if (query.transactionIds) {
        if (Array.isArray(query.transactionIds)) {
          const processedTransactionIds = query.transactionIds.map(transactionId => new ObjectId(transactionId))
          filter._id = { $in: processedTransactionIds }
        }
        else { filter._id = new ObjectId(query.transactionIds) }
      }
      if (query.fromDate || query.toDate) {
        filter.transactionTime = {}
        if (query.fromDate) filter.transactionTime.$gte = new Date(query.fromDate)
        if (query.toDate) filter.transactionTime.$lte = new Date(query.toDate)
      }
      if (query.moneySourceId && query.moneySourceType) { // account, savings, accumulation
        filter.$or = [
          { moneyFromType : query.moneySourceType, moneyFromId : new ObjectId(query.moneySourceId) },
          { moneyTargetType: query.moneySourceType, moneyTargetId : new ObjectId(query.moneySourceId) }
        ]
      }
    }
    const result = await transactionModel.getIndividualTransactions(filter)

    for (const transaction of result || []) {
      const transactionTypeModelHandler = transactionTypeModelHandle[transaction?.type]
      if (!transactionTypeModelHandler) break

      transaction.detailInfo = await transactionTypeModelHandler.findOneByTransactionId(transaction?._id)
      if (transaction.detailInfo?.moneyFromId) {
        const moneySourceModelHandler = moneySourceModelHandle[transaction.detailInfo?.moneyFromType]
        transaction.detailInfo.moneyFrom = await moneySourceModelHandler.findOneById(transaction.detailInfo.moneyFromId)
      }
      if (transaction.detailInfo?.moneyTargetId) {
        const moneySourceModelHandler = moneySourceModelHandle[transaction.detailInfo?.moneyTargetType]
        transaction.detailInfo.moneyTarget = await moneySourceModelHandler.findOneById(transaction.detailInfo.moneyTargetId)
      }
      if (transaction.detailInfo?.borrowerId) {
        transaction.detailInfo.borrower = await contactModel.findOneById(transaction.detailInfo?.borrowerId)
      }
      if (transaction.detailInfo?.lenderId) {
        transaction.detailInfo.lender = await contactModel.findOneById(transaction.detailInfo?.lenderId)
      }
      if (transaction.detailInfo?.loanTransactionId) {
        result.loanTransaction = await transactionModel.findOneById(transaction.detailInfo?.loanTransactionId)
      }
      if (transaction.detailInfo?.borrowingTransactionId) {
        result.borrowingTransaction = await transactionModel.findOneById(transaction.detailInfo?.borrowingTransactionId)
      }
    }

    return result
  } catch (error) { throw error }
}

const getFamilyTransactions = async (familyId, query) => {
  try {
    const filter = {}

    filter.ownerType = OWNER_TYPE.FAMILY
    filter.ownerId = new ObjectId(familyId)
    filter._destroy = false

    if (query) {
      if (query.type) filter.type = query.type
      if (query.categoryId) filter.categoryId = new ObjectId(query.categoryId)
      if (query.transactionIds) {
        if (Array.isArray(query.transactionIds)) {
          const processedTransactionIds = query.transactionIds.map(transactionId => new ObjectId(transactionId))
          filter._id = { $in: processedTransactionIds }
        }
        else { filter._id = new ObjectId(query.transactionIds) }
      }
      if (query.fromDate || query.toDate) {
        filter.transactionTime = {}
        if (query.fromDate) filter.transactionTime.$gte = new Date(query.fromDate)
        if (query.toDate) filter.transactionTime.$lte = new Date(query.toDate)
      }
      if (query.moneySourceId && query.moneySourceType) { // account, savings, accumulation
        filter.$or = [
          { moneyFromType : query.moneySourceType, moneyFromId : new ObjectId(query.moneySourceId) },
          { moneyTargetType: query.moneySourceType, moneyTargetId : new ObjectId(query.moneySourceId) }
        ]
      }
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

    let result = await transactionModel.getDetailTransaction(filter)
    // console.log('🚀 ~ getDetailIndividualTransaction ~ result:', result)
    if (result.type == TRANSACTION_TYPES.LOAN) {
      result.collectionTransaction = await collectionModel.findOneByLoanTransactionId(result._id)
    }
    if (result.type == TRANSACTION_TYPES.BORROWING) {
      result.repaymentTransaction = await repaymentModel.findOneByBorrowingTransactionId(result._id)
    }

    const transactionTypeModelHandler = transactionTypeModelHandle[result?.type]
    if (!transactionTypeModelHandler) {
      throw new ApiError(StatusCodes.BAD_REQUEST, `Transaction type ${result?.type} is not supported.`)
    }
    result.detailInfo = await transactionTypeModelHandler.findOneByTransactionId(transactionId)
    if (result.detailInfo?.moneyFromId) {
      const moneySourceModelHandler = moneySourceModelHandle[result.detailInfo?.moneyFromType]
      result.detailInfo.moneyFrom = await moneySourceModelHandler.findOneById(result.detailInfo.moneyFromId)
    }
    if (result.detailInfo?.moneyTargetId) {
      const moneySourceModelHandler = moneySourceModelHandle[result.detailInfo?.moneyTargetType]
      result.detailInfo.moneyTarget = await moneySourceModelHandler.findOneById(result.detailInfo.moneyTargetId)
    }
    if (result.detailInfo?.borrowerId) {
      result.detailInfo.borrower = await contactModel.findOneById(result.detailInfo?.borrowerId)
    }
    if (result.detailInfo?.lenderId) {
      result.detailInfo.lender = await contactModel.findOneById(result.detailInfo?.lenderId)
    }
    if (result.detailInfo?.loanTransactionId) {
      result.loanTransaction = await transactionModel.findOneById(result.detailInfo?.loanTransactionId)
    }
    if (result.detailInfo?.borrowingTransactionId) {
      result.borrowingTransaction = await transactionModel.findOneById(result.detailInfo?.borrowingTransactionId)
    }

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

const getIndividualRecentTransactions = async (userId) => {
  try {
    const filter = {
      ownerType: OWNER_TYPE.INDIVIDUAL,
      ownerId: new ObjectId(userId),
      _destroy: false
    }

    const result = await transactionModel.getRecentTransactions(filter)
    return result
  } catch (error) { throw error }
}

const getFamilyRecentTransactions = async (familyId) => {
  try {
    const filter = {
      ownerType: OWNER_TYPE.FAMILY,
      ownerId: new ObjectId(familyId),
      _destroy: false
    }

    const result = await transactionModel.getRecentTransactions(filter)
    return result
  } catch (error) { throw error }
}

const getManyIndividualDetailTransaction = async (reqBody) => {
  try {
    const type = reqBody?.type
    const transactionIds = reqBody?.transactionIds.map(item => new ObjectId(item))
    const transactionTypeModelHandler = transactionTypeModelHandle[type]

    const filter = {
      _destroy: false,
      transactionId: { $in: transactionIds }
    }

    const result = await transactionTypeModelHandler.getManyDetailTransactions(filter)

    return result
  } catch (error) { throw error }
}

const getManyFamilyDetailTransaction = async (reqBody) => {
  try {
    const type = reqBody?.type
    const transactionsIds = reqBody?.transactionIds.map(item => new ObjectId(item))
    const transactionTypeModelHandler = transactionTypeModelHandle[type]

    const filter = {
      _destroy: false,
      transactionId: { $in: transactionsIds }
    }

    const result = await transactionTypeModelHandler.getManyDetailTransactions(filter)

    return result
  } catch (error) { throw error }
}

export const transactionService = {
  createNew,
  createIndividualTransaction,
  createFamilyTransaction,
  getIndividualTransactions,
  getFullInfoIndividualTransactions,
  getFamilyTransactions,
  getDetailIndividualTransaction,
  getDetailFamilyTransaction,
  getIndividualRecentTransactions,
  getFamilyRecentTransactions,
  getManyIndividualDetailTransaction,
  getManyFamilyDetailTransaction
}
