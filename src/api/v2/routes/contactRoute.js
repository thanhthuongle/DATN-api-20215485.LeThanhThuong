import { Router } from 'express'
import { getContactsBySpace } from '../controllers/contactController'

const contactRoute = Router()

contactRoute.get('/spaces/:spaceId/contacts', getContactsBySpace)

export default contactRoute
