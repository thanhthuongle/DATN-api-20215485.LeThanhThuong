import express from 'express'
import {
  getHealth,
  getPostgresHealth
} from '~/api/v2/controllers/healthController'
import { validateHealthQuery } from '~/api/v2/validations/healthValidation'

const Router = express.Router()

Router.get('/', validateHealthQuery, getHealth)
Router.get('/postgres', validateHealthQuery, getPostgresHealth)

export const healthRoutes = Router
