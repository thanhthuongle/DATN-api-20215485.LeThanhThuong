import { StatusCodes } from 'http-status-codes'
import { budgetService } from '~/services/budgetService'

const createIndividualBudget = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id

    const createdAccount = await budgetService.createIndividualBudget(userId, req.body)

    res.status(StatusCodes.CREATED).json(createdAccount)
  } catch (error) { next(error) }
}

const createFamilyBudget = async (req, res, next) => {
  try {
    const familyId = req.params.familyId

    const createdAccount = await budgetService.createFamilyBudget(familyId, req.body)

    res.status(StatusCodes.CREATED).json(createdAccount)
  } catch (error) { next(error) }
}

export const budgetController = {
  createIndividualBudget,
  createFamilyBudget
}