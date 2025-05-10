import { StatusCodes } from 'http-status-codes'
import { moneySourceService } from '~/services/moneySourceService'

const getIndividualMoneySource = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id

    const result = await moneySourceService.getIndividualMoneySource(userId)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const getFamilyMoneySource = async (req, res, next) => {
  try {
    const familyId = req.params.familyId

    const result = await moneySourceService.getFamilyMoneySource(familyId)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

export const moneySourceController = {
  getIndividualMoneySource,
  getFamilyMoneySource
}