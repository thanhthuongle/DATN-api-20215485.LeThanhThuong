import { StatusCodes } from 'http-status-codes'
import { loanService } from '~/services/loanService'

const updateTrustLevel = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id

    const result = await loanService.updateTrustLevel(userId, req?.body)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

export const loanController = {
  updateTrustLevel
}
