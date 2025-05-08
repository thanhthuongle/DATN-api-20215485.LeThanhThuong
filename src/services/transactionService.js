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


const createNew = async (reqBody) => {
  const session = MongoClientInstance.startSession()
  let transactionInsertedId
  const transactionTypeModelHandle = {
    [TRANSACTION_TYPES.EXPENSE]: expenseModel,
    [TRANSACTION_TYPES.INCOME]: incomeModel,
    [TRANSACTION_TYPES.LOAN]: loanModel,
    [TRANSACTION_TYPES.BORROWING]: borrowingModel,
    [TRANSACTION_TYPES.TRANSFER]: transferModel,
    [TRANSACTION_TYPES.CONTRIBUTION]: contributionModel
  }
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

export const transactionService = {
  createNew
}
