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

const getIndividualAccounts = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id

    const result = await accountService.getIndividualAccounts(userId)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const getFamilyAccounts = async (req, res, next) => {
  try {
    const familyId = req.params.familyId

    const result = await accountService.getFamilyAccounts(familyId)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const blockAccount = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const accountId = req.params.accountId

    const result = await accountService.blockAccount(userId, accountId)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const unblockAccount = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const accountId = req.params.accountId

    const result = await accountService.unblockAccount(userId, accountId)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

export const accountController = {
  createIndividualAccount,
  createFamilyAccount,
  getIndividualAccounts,
  getFamilyAccounts,
  blockAccount,
  unblockAccount
}
