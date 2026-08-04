import { Router } from 'express'
import { repay } from '../controllers/repaymentController'

const repaymentRoute = Router()
repaymentRoute.post('/repayments', repay)
export default repaymentRoute
