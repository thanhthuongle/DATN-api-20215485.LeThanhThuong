/* eslint-disable no-useless-catch */
import { ObjectId } from 'mongodb'
import { contactModel } from '~/models/contactModel'
import { OWNER_TYPE } from '~/utils/constants'

const createIndividualContact = async (userId, reqBody) => {
  try {
    const newContactData = {
      ownerType: OWNER_TYPE.INDIVIDUAL,
      ownerId: userId,
      ...reqBody
    }

    const createdContact = await contactModel.createNew(newContactData)
    const getNewContact = await contactModel.findOneById(createdContact.insertedId)

    return getNewContact
  } catch (error) { throw error }
}

const createFamilyContact = async (familyId, reqBody) => {
  try {
    const newContactData = {
      ownerType: OWNER_TYPE.FAMILY,
      ownerId: familyId,
      ...reqBody
    }

    const createdContact = await contactModel.createNew(newContactData)
    const getNewContact = await contactModel.findOneById(createdContact.insertedId)

    return getNewContact
  } catch (error) { throw error }
}

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
  createIndividualContact,
  createFamilyContact,
  getIndividualContacts,
  getFamilyContacts
}
