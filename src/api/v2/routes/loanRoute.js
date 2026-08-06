import { Router } from 'express'
import { createLoan } from '../controllers/loanController'

const loanRoute = Router()
loanRoute.post('/loans', createLoan)
export default loanRoute
