import { Router } from 'express'
import { getCategoriesBySpace } from '../controllers/categoryController'

const categoryRoute = Router()

categoryRoute.get('/spaces/:spaceId/categories', getCategoriesBySpace)

export default categoryRoute
