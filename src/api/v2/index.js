import express from 'express'
import { healthRoutes } from '~/api/v2/routes/healthRoute'
import bankRoute from '~/api/v2/routes/bankRoute'
import categoryRoute from '~/api/v2/routes/categoryRoute'
import contactRoute from '~/api/v2/routes/contactRoute'
import spaceRoute from '~/api/v2/routes/spaceRoute'
import accountRoute from '~/api/v2/routes/accountRoute'
import incomeRoute from '~/api/v2/routes/incomeRoute'
import expenseRoute from '~/api/v2/routes/expenseRoute'
import transferRoute from '~/api/v2/routes/transferRoute'
import { correlationIdMiddleware } from '~/api/v2/middlewares/correlationId'

const Router = express.Router()

Router.use(correlationIdMiddleware)
Router.use('/health', healthRoutes)
Router.use('/banks', bankRoute)
Router.use('/', categoryRoute)
Router.use('/', contactRoute)
Router.use('/', spaceRoute)
Router.use('/', accountRoute)
Router.use('/', incomeRoute)
Router.use('/', expenseRoute)
Router.use('/', transferRoute)

export const v2Routes = Router
