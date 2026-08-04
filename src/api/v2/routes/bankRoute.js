import { Router } from 'express'
import { getBanks, getBankById } from '../controllers/bankController'

const bankRoute = Router()

bankRoute.get('/', getBanks)
bankRoute.get('/:publicId', getBankById)

export default bankRoute
