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
    const userId = req.jwtDecoded._id
    const familyId = req.params.familyId

    const createdSaving = await savingService.createFamilySaving(userId, familyId, req.body)

    res.status(StatusCodes.CREATED).json(createdSaving)
  } catch (error) { next(error) }
}

const getIndividualSavings = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id

    const result = await savingService.getIndividualSavings(userId)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

export const savingController = {
  createIndividualSaving,
  createFamilySaving,
  getIndividualSavings
}