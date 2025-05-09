import { StatusCodes } from 'http-status-codes'
import { transactionService } from '~/services/transactionService'

const createNew = async (req, res, next) => {
  try {
    // console.log('req.body: ', req.body)
    // console.log('req.query: ', req.query)
    // console.log('req.params: ', req.params)
    const createdTransaction = await transactionService.createNew(req.body)

    res.status(StatusCodes.CREATED).json(createdTransaction)
  } catch (error) { next(error) }
}

const createIndividualTransaction = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const createdTransaction = await transactionService.createIndividualTransaction(userId, req.body)

    res.status(StatusCodes.CREATED).json(createdTransaction)
  } catch (error) { next(error) }
}

const createFamilyTransaction = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const familyId = req.params.familyId
    const createdTransaction = await transactionService.createFamilyTransaction(userId, familyId, req.body)

    res.status(StatusCodes.CREATED).json(createdTransaction)
  } catch (error) { next(error) }
}

const getIndividualTransactions = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const query = req.query
    const result = await transactionService.getIndividualTransactions(userId, query)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const getFamilyTransactions = async (req, res, next) => {
  try {
    const query = req.query
    const familyId = req.params.familyId
    const result = await transactionService.getFamilyTransactions(familyId, query)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const getDetailIndividualTransaction = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const transactionId = req.params.transactionId

    const result = await transactionService.getDetailIndividualTransaction(userId, transactionId)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const getDetailFamilyTransaction = async (req, res, next) => {
  try {
    const familyId = req.params.familyId
    const transactionId = req.params.transactionId

    const result = await transactionService.getDetailFamilyTransaction(familyId, transactionId)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

export const transactionController = {
  createNew,
  createIndividualTransaction,
  createFamilyTransaction,
  getIndividualTransactions,
  getFamilyTransactions,
  getDetailIndividualTransaction,
  getDetailFamilyTransaction
}
