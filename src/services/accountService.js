/* eslint-disable no-useless-catch */
import { ObjectId } from 'mongodb'
import { MongoClientInstance } from '~/config/mongodb'
import { accountModel } from '~/models/accountModel'
import { moneySourceModel } from '~/models/moneySourceModel'
import { OWNER_TYPE } from '~/utils/constants'

const createIndividualAccount = async (userId, reqBody) => {
  const session = MongoClientInstance.startSession()
  try {
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
      balance: reqBody.initBalance,
      ...reqBody
    }

    const createdAccount = await accountModel.createNew(data, { session })
    const getNewAccount = await accountModel.findOneById(createdAccount.insertedId, { session })

    if (getNewAccount) {
      await moneySourceModel.pushAccountIds(getNewAccount, { session })
    }

    return getNewAccount
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

    return getNewAccount
  } catch (error) {
    if (session.inTransaction()) { await session.abortTransaction().catch(() => {}) }
    throw error
  } finally {
    await session.endSession()
  }
}

const getIndividualAccounts = async (userId) => {
  try {
    const filter = {}
    filter.ownerType = OWNER_TYPE.INDIVIDUAL
    filter.ownerId = new ObjectId(userId)
    filter._destroy = false

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

export const accountService = {
  createIndividualAccount,
  createFamilyAccount,
  getIndividualAccounts,
  getFamilyAccounts
}