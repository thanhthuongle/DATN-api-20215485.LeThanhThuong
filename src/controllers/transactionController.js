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
    const images = req.files
    // console.log('🚀 ~ createIndividualTransaction ~ images:', images)
    const createdTransaction = await transactionService.createIndividualTransaction(userId, req.body, images)

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
    const query = req?.query?.q
    const result = await transactionService.getIndividualTransactions(userId, query)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const getFullInfoIndividualTransactions = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const query = req?.query?.q
    const result = await transactionService.getFullInfoIndividualTransactions(userId, query)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const getFamilyTransactions = async (req, res, next) => {
  try {
    const query = req.query?.q
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

const getIndividualRecentTransactions = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const result = await transactionService.getIndividualRecentTransactions(userId)
    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const getFamilyRecentTransactions = async (req, res, next) => {
  try {
    const familyId = req.params.familyId
    const result = await transactionService.getIndividualRecentTransactions(familyId)
    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const getManyIndividualDetailTransaction = async (req, res, next) => {
  try {
    const result = await transactionService.getManyIndividualDetailTransaction(req.body)
    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const getManyFamilyDetailTransaction = async (req, res, next) => {
  try {
    const result = await transactionService.getManyFamilyDetailTransaction(req.body)
    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

export const transactionController = {
  createNew,
  createIndividualTransaction,
  createFamilyTransaction,
  getIndividualTransactions,
  getFullInfoIndividualTransactions,
  getFamilyTransactions,
  getDetailIndividualTransaction,
  getDetailFamilyTransaction,
  getIndividualRecentTransactions,
  getFamilyRecentTransactions,
  getManyIndividualDetailTransaction,
  getManyFamilyDetailTransaction
}
