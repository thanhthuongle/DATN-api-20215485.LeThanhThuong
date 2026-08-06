import { Router } from 'express'
import { contribute } from '../controllers/contributionController'

const contributionRoute = Router()
contributionRoute.post('/contributions', contribute)
export default contributionRoute
