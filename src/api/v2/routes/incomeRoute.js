import { Router } from 'express'
import { createIncome } from '../controllers/incomeController'

const incomeRoute = Router()
incomeRoute.post('/incomes', createIncome)
export default incomeRoute
