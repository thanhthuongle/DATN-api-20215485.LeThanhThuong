/* eslint-disable no-useless-catch */
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { MongoClientInstance } from '~/config/mongodb'
import { accountModel } from '~/models/accountModel'
import { bankModel } from '~/models/bankModel'
import { moneySourceModel } from '~/models/moneySourceModel'
import ApiError from '~/utils/ApiError'
import { OWNER_TYPE } from '~/utils/constants'
import { commitWithRetry, runTransactionWithRetry } from '~/utils/mongoTransaction'

const createIndividualAccount = async (userId, reqBody) => {
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

      if (reqBody?.bankId) {
        const bank = await bankModel.findOneById(reqBody?.bankId, { session })
        if (!bank) throw new ApiError(StatusCodes.NOT_FOUND, 'Ngân hàng không tồn tại!')
        reqBody.icon = bank?.logo
      }
      const data = {
        ownerType: OWNER_TYPE.INDIVIDUAL,
        ownerId: userId,
        moneySourceId: (moneySource._id).toString(),
        balance: reqBody.initBalance,
        ...reqBody
      }

      const createdAccount = await accountModel.createNew(data, { session })
      const getNewAccount = await accountModel.findOneById(createdAccount.insertedId, { session })

      if (getNewAccount) {
        await moneySourceModel.pushAccountIds(getNewAccount, { session })
      }

      await commitWithRetry(session)
      return getNewAccount
    }, MongoClientInstance, session)

    return result
  } catch (error) {
    if (session.inTransaction()) { await session.abortTransaction().catch(() => {}) }
    throw error
  } finally {
    await session.endSession()
  }
}

const createFamilyAccount = async (familyId, reqBody) => {
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

      const createdAccount = await accountModel.createNew(data, { session })
      const getNewAccount = await accountModel.findOneById(createdAccount.insertedId, { session })

      if (getNewAccount) {
        await moneySourceModel.pushAccountIds(getNewAccount, { session })
      }

      await commitWithRetry(session)
      return getNewAccount
    }, MongoClientInstance, session)

    return result
  } catch (error) {
    if (session.inTransaction()) { await session.abortTransaction().catch(() => {}) }
    throw error
  } finally {
    await session.endSession()
  }
}

const getIndividualAccounts = async (userId, query) => {
  try {
    const filter = {}
    filter.ownerType = OWNER_TYPE.INDIVIDUAL
    filter.ownerId = new ObjectId(userId)
    filter._destroy = false

    if (query?.isBlock) {
      if (query.isBlock == 'true') filter.isBlock = true
      else if (query.isBlock == 'false') filter.isBlock = false
    }

    const result = await accountModel.getAccounts(filter)

    return result
  } catch (error) { throw error }
}

const getFamilyAccounts = async (familyId) => {
  try {
    const filter = {}
    filter.ownerType = OWNER_TYPE.FAMILY
    filter.ownerId = new ObjectId(familyId)
    filter._destroy = false

    const result = await accountModel.getAccounts(filter)

    return result
  } catch (error) { throw error }
}

const blockAccount = async(userId, accountId) => {
  try {
    // kiểm tra ví có tồn tại ko
    const account = await accountModel.findOneById(new ObjectId(accountId))
    if (!account) throw new ApiError(StatusCodes.NOT_FOUND, 'Tài khoản không tồn tại!')

    // Kiểm tra quyền truy cập
    if (!(new ObjectId(userId).equals(new ObjectId(account?.ownerId)))) throw new ApiError(StatusCodes.FORBIDDEN, 'Không có quyền truy cập tài khoản này!')

    // Kiểm tra ví đã khóa chưa
    if (account?.isBlock == true) throw new ApiError(StatusCodes.CONFLICT, 'Tài khoản này đã được khóa!')

    const result = await accountModel.blockAccount(accountId)

    return result
  } catch (error) { throw error }
}

const unblockAccount = async(userId, accountId) => {
  try {
    // kiểm tra ví có tồn tại ko
    const account = await accountModel.findOneById(new ObjectId(accountId))
    if (!account) throw new ApiError(StatusCodes.NOT_FOUND, 'Tài khoản không tồn tại!')

    // Kiểm tra quyền truy cập
    if (!(new ObjectId(userId).equals(new ObjectId(account?.ownerId)))) throw new ApiError(StatusCodes.FORBIDDEN, 'Không có quyền truy cập tài khoản này!')

    // Kiểm tra ví đã khóa chưa
    if (account?.isBlock == false) throw new ApiError(StatusCodes.CONFLICT, 'Tài khoản này không bị khóa!')

    const result = await accountModel.unblockAccount(accountId)

    return result
  } catch (error) { throw error }
}

export const accountService = {
  createIndividualAccount,
  createFamilyAccount,
  getIndividualAccounts,
  getFamilyAccounts,
  blockAccount,
  unblockAccount
}