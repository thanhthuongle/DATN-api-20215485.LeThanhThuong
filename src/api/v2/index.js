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
import loanRoute from '~/api/v2/routes/loanRoute'
import borrowingRoute from '~/api/v2/routes/borrowingRoute'
import repaymentRoute from '~/api/v2/routes/repaymentRoute'
import collectionRoute from '~/api/v2/routes/collectionRoute'
import contributionRoute from '~/api/v2/routes/contributionRoute'
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
Router.use('/', loanRoute)
Router.use('/', borrowingRoute)
Router.use('/', repaymentRoute)
Router.use('/', collectionRoute)
Router.use('/', contributionRoute)

export const v2Routes = Router
