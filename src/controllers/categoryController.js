import { StatusCodes } from 'http-status-codes'
import { categoryService } from '~/services/categoryService'

const getIndividualCategories = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const query = req.query?.q

    const result = await categoryService.getIndividualCategories(userId, query)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const getFamilyCategories = async (req, res, next) => {
  try {
    const query = req.query?.q
    const familyId = req.params.familyId

    const result = await categoryService.getFamilyCategories(familyId, query)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

export const categoryController = {
  getIndividualCategories,
  getFamilyCategories
}