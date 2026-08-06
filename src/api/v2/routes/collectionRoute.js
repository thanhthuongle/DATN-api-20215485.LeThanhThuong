import { Router } from 'express'
import { collect } from '../controllers/collectionController'

const collectionRoute = Router()
collectionRoute.post('/collections', collect)
export default collectionRoute
