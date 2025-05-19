import { StatusCodes } from 'http-status-codes'
import { accumulationService } from '~/services/accumulationService'

const createIndividualAccumulation = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id

    const createdAccumulation = await accumulationService.createIndividualAccumulation(userId, req.body)

    res.status(StatusCodes.CREATED).json(createdAccumulation)
  } catch (error) { next(error) }
}

const createFamilyAccumulation = async (req, res, next) => {
  try {
    const familyId = req.params.familyId

    const createdAccumulation = await accumulationService.createFamilyAccumulation(familyId, req.body)

    res.status(StatusCodes.CREATED).json(createdAccumulation)
  } catch (error) { next(error) }
}

const getIndividualAccumulations = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id

    const result = await accumulationService.getIndividualAccumulations(userId)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

export const accumulationController = {
  createIndividualAccumulation,
  createFamilyAccumulation,
  getIndividualAccumulations
}