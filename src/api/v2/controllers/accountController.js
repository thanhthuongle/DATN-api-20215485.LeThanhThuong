import accountService from '~/v2/modules/account/services/account.service'
import { toAccountListResponse, toAccountResponse } from '../mappers/accountMapper'

export const getAccountsBySpace = async (req, res, next) => {
  try {
    const spaceId = BigInt(req.params.spaceId)
    const accounts = await accountService.getAccountsBySpace(spaceId)
    res.json({ data: toAccountListResponse(accounts) })
  } catch (error) {
    next(error)
  }
}

export const getAccountByPublicId = async (req, res, next) => {
  try {
    const account = await accountService.getAccountByPublicId(req.params.publicId)
    if (!account) return res.status(404).json({ message: 'Account not found' })
    res.json({ data: toAccountResponse(account) })
  } catch (error) {
    next(error)
  }
}

export const createAccount = async (req, res, next) => {
  try {
    const result = await accountService.createAccount({
      actor: { type: 'USER', id: req.userId || 'system' },
      spaceId: BigInt(req.body.spaceId),
      name: req.body.name,
      type: req.body.type || 'WALLET',
      bankId: req.body.bankId ? BigInt(req.body.bankId) : null,
      initialBalance: BigInt(req.body.initialBalance || 0),
      icon: req.body.icon,
      description: req.body.description
    })
    res.status(201).json({ data: result })
  } catch (error) {
    next(error)
  }
}
