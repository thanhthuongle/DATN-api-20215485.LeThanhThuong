import { Router } from 'express'
import { createExpense } from '../controllers/expenseController'

const expenseRoute = Router()
expenseRoute.post('/expenses', createExpense)
export default expenseRoute
