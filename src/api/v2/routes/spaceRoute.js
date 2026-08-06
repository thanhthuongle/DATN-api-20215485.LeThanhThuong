import { Router } from 'express'
import { getSpacesByUser, getSpaceByPublicId } from '../controllers/spaceController'

const spaceRoute = Router()

spaceRoute.get('/users/:userId/spaces', getSpacesByUser)
spaceRoute.get('/spaces/:publicId', getSpaceByPublicId)

export default spaceRoute
