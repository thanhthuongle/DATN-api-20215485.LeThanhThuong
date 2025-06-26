/* eslint-disable no-useless-catch */
import { ObjectId } from 'mongodb'
import { categoryModel } from '~/models/categoryModel'
import { OWNER_TYPE } from '~/utils/constants'

const getIndividualCategories = async (userId, query) => {
  try {
    const filter = {}

    filter.ownerType = OWNER_TYPE.INDIVIDUAL
    filter.ownerId = new ObjectId(userId)
    filter._destroy = false

    if (query.type) {
      if (Array.isArray(query.type)) { filter.type = { $in: query.type } }
      else { filter.type = query.type }
    }

    const result = await categoryModel.getIndividualCategories(filter)

    return result
  } catch (error) { throw error }
}

const getFamilyCategories = async (familyId, query) => {
  try {
    const filter = {}

    filter.ownerType = OWNER_TYPE.FAMILY
    filter.ownerId = new ObjectId(familyId)
    filter._destroy = false

    if (query.type) {
      if (Array.isArray(query.type)) { filter.type = { $in: query.type } }
      else { filter.type = query.type }
    }


    const result = await categoryModel.getFamilyCategories(filter)

    return result
  } catch (error) { throw error }
}

export const categoryService = {
  getIndividualCategories,
  getFamilyCategories
}
