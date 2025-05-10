import { StatusCodes } from 'http-status-codes'
import { savingService } from '~/services/savingService'

const createIndividualSaving = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id

    const createdSaving = await savingService.createIndividualSaving(userId, req.body)

    res.status(StatusCodes.CREATED).json(createdSaving)
  } catch (error) { next(error) }
}

const createFamilySaving = async (req, res, next) => {
  try {
    const familyId = req.params.familyId

    const createdSaving = await savingService.createFamilySaving(familyId, req.body)

    res.status(StatusCodes.CREATED).json(createdSaving)
  } catch (error) { next(error) }
}

export const savingController = {
  createIndividualSaving,
  createFamilySaving
}