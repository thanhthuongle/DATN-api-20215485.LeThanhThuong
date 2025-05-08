import { StatusCodes } from 'http-status-codes'
import { transactionService } from '~/services/transactionService'

const createNew = async (req, res, next) => {
  try {
    // console.log('req.body: ', req.body)
    // console.log('req.query: ', req.query)
    // console.log('req.params: ', req.params)
    const createdTransaction = await transactionService.createNew(req.body)

    res.status(StatusCodes.CREATED).json({ createdTransaction })
  } catch (error) { next(error) }
}

export const transactionController = {
  createNew
}
