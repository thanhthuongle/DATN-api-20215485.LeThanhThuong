import { Router } from 'express'
import { getAccountsBySpace, getAccountByPublicId, createAccount } from '../controllers/accountController'

const accountRoute = Router()

accountRoute.get('/spaces/:spaceId/accounts', getAccountsBySpace)
accountRoute.get('/accounts/:publicId', getAccountByPublicId)
accountRoute.post('/accounts', createAccount)

export default accountRoute
