import express from 'express'
import { healthRoutes } from '~/api/v2/routes/healthRoute'
import bankRoute from '~/api/v2/routes/bankRoute'
import categoryRoute from '~/api/v2/routes/categoryRoute'
import contactRoute from '~/api/v2/routes/contactRoute'
import spaceRoute from '~/api/v2/routes/spaceRoute'
import { correlationIdMiddleware } from '~/api/v2/middlewares/correlationId'

const Router = express.Router()

Router.use(correlationIdMiddleware)
Router.use('/health', healthRoutes)
Router.use('/banks', bankRoute)
Router.use('/', categoryRoute)
Router.use('/', contactRoute)
Router.use('/', spaceRoute)

export const v2Routes = Router
