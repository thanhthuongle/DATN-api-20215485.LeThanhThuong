import { Router } from 'express'
import { createTransfer } from '../controllers/transferController'

const transferRoute = Router()
transferRoute.post('/transfers', createTransfer)
export default transferRoute
