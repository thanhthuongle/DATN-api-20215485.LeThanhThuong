import express from 'express'
import { healthRoutes } from '~/api/v2/routes/healthRoute'
import bankRoute from '~/api/v2/routes/bankRoute'
import categoryRoute from '~/api/v2/routes/categoryRoute'
import contactRoute from '~/api/v2/routes/contactRoute'
import spaceRoute from '~/api/v2/routes/spaceRoute'
import accountRoute from '~/api/v2/routes/accountRoute'
import { correlationIdMiddleware } from '~/api/v2/middlewares/correlationId'

const Router = express.Router()

Router.use(correlationIdMiddleware)
Router.use('/health', healthRoutes)
Router.use('/banks', bankRoute)
Router.use('/', categoryRoute)
Router.use('/', contactRoute)
Router.use('/', spaceRoute)
Router.use('/', accountRoute)

export const v2Routes = Router
