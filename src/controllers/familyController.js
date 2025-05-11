import { StatusCodes } from 'http-status-codes'
import { familyService } from '~/services/familyService'

const createNew = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const familyBackgroundImage = req.file

    const createdAccount = await familyService.createNew(userId, req.body, familyBackgroundImage)

    res.status(StatusCodes.CREATED).json(createdAccount)
  } catch (error) { next(error) }
}

const getFamilies = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id

    const result = await familyService.getFamilies(userId)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

export const familyController = {
  createNew,
  getFamilies
}