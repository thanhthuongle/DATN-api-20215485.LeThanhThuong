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

const getIndividualBudgets = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const q = req.query
    const isFinish = q.isFinish === 'true'

    const result = await budgetService.getIndividualBudgets(userId, isFinish)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const getFamilyBudgets = async (req, res, next) => {
  try {
    const familyId = req.params.familyId
    const q = req.query
    const isFinish = q.isFinish === 'true'

    const result = await budgetService.getFamilyBudgets(familyId, isFinish)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

export const budgetController = {
  createIndividualBudget,
  createFamilyBudget,
  getIndividualBudgets,
  getFamilyBudgets
}