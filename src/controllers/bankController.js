import { StatusCodes } from 'http-status-codes'
import { bankService } from '~/services/bankService'

const getBanks = async (req, res, next) => {
  try {
    const result = await bankService.getBanks()

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const getDetail = async (req, res, next) => {
  try {
    const bankId = req.params.bankId

    const result = await bankService.getDetail(bankId)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

export const bankController = {
  getBanks,
  getDetail
}