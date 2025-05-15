import { StatusCodes } from 'http-status-codes'
import { contactService } from '~/services/contactService'

const createIndividualContact= async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id

    const createdAccount = await contactService.createIndividualContact(userId, req.body)

    res.status(StatusCodes.CREATED).json(createdAccount)
  } catch (error) { next(error) }
}

const createFamilyContact = async (req, res, next) => {
  try {
    const familyId = req.params.familyId

    const createdAccount = await contactService.createFamilyContact(familyId, req.body)

    res.status(StatusCodes.CREATED).json(createdAccount)
  } catch (error) { next(error) }
}

const getIndividualContacts = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id

    const result = await contactService.getIndividualContacts(userId)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const getFamilyContacts = async (req, res, next) => {
  try {
    const familyId = req.params.familyId

    const result = await contactService.getFamilyContacts(familyId)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

export const contactController = {
  createIndividualContact,
  createFamilyContact,
  getIndividualContacts,
  getFamilyContacts
}
