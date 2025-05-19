/* eslint-disable no-useless-catch */
import { ObjectId } from 'mongodb'
import { MongoClientInstance } from '~/config/mongodb'
import { accumulationModel } from '~/models/accumulationModel'
import { moneySourceModel } from '~/models/moneySourceModel'
import { OWNER_TYPE } from '~/utils/constants'
import { commitWithRetry, runTransactionWithRetry } from '~/utils/mongoTransaction'

const createIndividualAccumulation = async (userId, reqBody) => {
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

      const data = {
        ownerType: OWNER_TYPE.INDIVIDUAL,
        ownerId: userId,
        moneySourceId: (moneySource._id).toString(),
        ...reqBody
      }

      const createdAccumulation = await accumulationModel.createNew(data, { session })
      const getNewAccumulation = await accumulationModel.findOneById(createdAccumulation.insertedId, { session })

      if (getNewAccumulation) {
        await moneySourceModel.pushAccumulationIds(getNewAccumulation, { session })
      }

      await commitWithRetry(session)
      return getNewAccumulation
    }, MongoClientInstance, session)

    return result
  } catch (error) {
    if (session.inTransaction()) { await session.abortTransaction().catch(() => {}) }
    throw error
  } finally {
    await session.endSession()
  }
}

const createFamilyAccumulation = async (familyId, reqBody) => {
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
        ...reqBody
      }

      const createdAccumulation = await accumulationModel.createNew(data, { session })
      const getNewAccumulation = await accumulationModel.findOneById(createdAccumulation.insertedId, { session })

      if (getNewAccumulation) {
        await moneySourceModel.pushAccumulationIds(getNewAccumulation, { session })
      }

      await commitWithRetry(session)
      return getNewAccumulation
    }, MongoClientInstance, session)

    return result
  } catch (error) {
    if (session.inTransaction()) { await session.abortTransaction().catch(() => {}) }
    throw error
  } finally {
    await session.endSession()
  }
}

const getIndividualAccumulations = async (userId) => {
  try {
    const filter = {}
    filter.ownerType = OWNER_TYPE.INDIVIDUAL
    filter.ownerId = new ObjectId(userId)
    filter._destroy = false

    const result = await accumulationModel.getAccumulations(filter)

    return result
  } catch (error) { throw error }
}

export const accumulationService = {
  createIndividualAccumulation,
  createFamilyAccumulation,
  getIndividualAccumulations
}