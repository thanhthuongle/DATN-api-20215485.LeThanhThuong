import { Router } from 'express'
import { createBorrowing } from '../controllers/borrowingController'

const borrowingRoute = Router()
borrowingRoute.post('/borrowings', createBorrowing)
export default borrowingRoute
