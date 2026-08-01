import express from 'express'
import { healthRoutes } from '~/api/v2/routes/healthRoute'
import { correlationIdMiddleware } from '~/api/v2/middlewares/correlationId'

const Router = express.Router()

Router.use(correlationIdMiddleware)
Router.use('/health', healthRoutes)

export const v2Routes = Router
