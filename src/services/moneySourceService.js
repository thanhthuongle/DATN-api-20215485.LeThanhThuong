/* eslint-disable no-useless-catch */
import { ObjectId } from 'mongodb'
import { moneySourceModel } from '~/models/moneySourceModel'
import { OWNER_TYPE } from '~/utils/constants'

const getIndividualMoneySource = async (userId) => {
  try {
    const filter = {}
    filter.ownerType = OWNER_TYPE.INDIVIDUAL
    filter.ownerId = new ObjectId(userId)
    filter._destroy = false

    const result = await moneySourceModel.getIndividualMoneySource(filter)

    return result
  } catch (error) { throw error }
}

const getFamilyMoneySource = async (familyId) => {
  try {
    const filter = {}
    filter.ownerType = OWNER_TYPE.FAMILY
    filter.ownerId = new ObjectId(familyId)
    filter._destroy = false

    const result = await moneySourceModel.getFamilyMoneySource(filter)

    return result
  } catch (error) { throw error }
}

export const moneySourceService = {
  getIndividualMoneySource,
  getFamilyMoneySource
}
