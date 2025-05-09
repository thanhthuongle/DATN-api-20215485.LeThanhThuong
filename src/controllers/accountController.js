import { StatusCodes } from 'http-status-codes'
import { accountService } from '~/services/accountService'

const createIndividualAccount = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id

    const createdAccount = await accountService.createIndividualAccount(userId, req.body)

    res.status(StatusCodes.CREATED).json(createdAccount)
  } catch (error) { next(error) }
}

const createFamilyAccount = async (req, res, next) => {
  try {
    const familyId = req.params.familyId

    const createdAccount = await accountService.createFamilyAccount(familyId, req.body)

    res.status(StatusCodes.CREATED).json(createdAccount)
  } catch (error) { next(error) }
}

export const accountController = {
  createIndividualAccount,
  createFamilyAccount
}