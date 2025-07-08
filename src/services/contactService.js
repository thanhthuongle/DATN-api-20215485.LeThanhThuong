/* eslint-disable no-useless-catch */
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { contactModel } from '~/models/contactModel'
import ApiError from '~/utils/ApiError'
import { OWNER_TYPE } from '~/utils/constants'

const createIndividualContact = async (userId, reqBody) => {
  try {
    const newContactData = {
      ownerType: OWNER_TYPE.INDIVIDUAL,
      ownerId: userId,
      ...reqBody
    }

    // kiểm tra liên hệ tạo mới đã tồn tại chưa
    const contact = await contactModel.findOneIndividualByName(userId, reqBody?.name)
    if (contact) throw new ApiError(StatusCodes.CONFLICT, 'Liên hệ đã tồn tại!')

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

const updateTrustLevel = async (userId, reqBody) => {
  try {
    // Kiểm tra dữ liệu
    const contact = await contactModel.findOneById(reqBody?.contactId)
    if (!contact) throw new ApiError(StatusCodes.NOT_FOUND, 'Liên hệ không tồn tại')
    if (contact?.ownerId.toString() != userId.toString()) throw new ApiError(StatusCodes.FORBIDDEN, 'Người dùng không có quyền cập nhật liên hệ này!')

    const updateData = {
      trustLevel: reqBody?.trustLevel
    }
    const result = await contactModel.update(contact._id, updateData)

    return result
} catch (error) { throw error }
}

export const contactService = {
  createIndividualContact,
  createFamilyContact,
  getIndividualContacts,
  getFamilyContacts,
  updateTrustLevel
}
