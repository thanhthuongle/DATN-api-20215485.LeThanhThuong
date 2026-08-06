import bankService from '~/v2/modules/bank/services/bank.service'
import { toBankListResponse, toBankResponse } from '../mappers/bankMapper'

export const getBanks = async (req, res, next) => {
  try {
    const banks = await bankService.getBanks()
    res.json({ data: toBankListResponse(banks) })
  } catch (error) {
    next(error)
  }
}

export const getBankById = async (req, res, next) => {
  try {
    const bank = await bankService.getBankByPublicId(req.params.publicId)
    if (!bank) return res.status(404).json({ message: 'Bank not found' })
    res.json({ data: toBankResponse(bank) })
  } catch (error) {
    next(error)
  }
}
