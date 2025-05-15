/* eslint-disable no-useless-catch */
import { ObjectId } from 'mongodb'
import { contactModel } from '~/models/contactModel'
import { OWNER_TYPE } from '~/utils/constants'

const getIndividualContacts = async (userId) => {
  try {
    const filter = {}

    filter.ownerType = OWNER_TYPE.INDIVIDUAL
    filter.ownerId = new ObjectId(userId)
    filter._destroy = false

    const result = await contactModel.getContacts(filter)

    return result
  } catch (error) { throw error }
}

const getFamilyContacts = async (familyId) => {
  try {
    const filter = {}

    filter.ownerType = OWNER_TYPE.FAMILY
    filter.ownerId = new ObjectId(familyId)
    filter._destroy = false

    const result = await contactModel.getContacts(filter)

    return result
  } catch (error) { throw error }
}

export const contactService = {
  getIndividualContacts,
  getFamilyContacts
}
