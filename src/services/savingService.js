/* eslint-disable no-useless-catch */
import { ObjectId } from 'mongodb'
import { MongoClientInstance } from '~/config/mongodb'
import { moneySourceModel } from '~/models/moneySourceModel'
import { savingsAccountModel } from '~/models/savingsAccountModel'
import { OWNER_TYPE } from '~/utils/constants'

const createIndividualSaving = async (userId, reqBody) => {
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

    const createdSaving = await savingsAccountModel.createNew(data, { session })
    const getNewSaving = await savingsAccountModel.findOneById(createdSaving.insertedId, { session })

    if (getNewSaving) {
      await moneySourceModel.pushSavingIds(getNewSaving, { session })

      //TODO: Tính toán, lên lịch các tác vụ tự động
    }

    return getNewSaving
  } catch (error) {
    if (session.inTransaction()) { await session.abortTransaction().catch(() => {}) }
    throw error
  } finally {
    await session.endSession()
  }
}

const createFamilySaving = async (familyId, reqBody) => {
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

    const createdSaving = await savingsAccountModel.createNew(data, { session })
    const getNewSaving = await savingsAccountModel.findOneById(createdSaving.insertedId, { session })

    if (getNewSaving) {
      await moneySourceModel.pushSavingIds(getNewSaving, { session })

      //TODO: Tính toán, lên lịch các tác vụ tự động
    }

    return getNewSaving
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