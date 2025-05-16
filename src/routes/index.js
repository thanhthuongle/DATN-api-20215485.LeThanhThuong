import express from 'express'
import { StatusCodes } from 'http-status-codes'
import { userRoutes } from './userRoutes'
import { transactionRoutes } from './transactionRoutes'
import { categoryRoutes } from './categoryRoute'
import { accountRoutes } from './accountRoute'
import { savingRoutes } from './savingRoute'
import { accumulationRoutes } from './accumulationRoute'
import { moneySourceRoutes } from './moneySourceRoute'
import { budgetRoutes } from './budgetRoute'
import { familyRoutes } from './familyRoute'
import { contactRoutes } from './contactRoute'
import { bankRoutes } from './bankRoute'

const Router = express.Router()

Router.get('/', (req, res) => {
  res.end('<h1>Hello World!</h1><hr>')
})

Router.get('/status', (req, res) => {
  res.status(StatusCodes.OK).json({
    message: 'APIs are ready to use'
  })
})

Router.use('/users', userRoutes)

Router.use('/transactions', transactionRoutes)

Router.use('/categories', categoryRoutes)

Router.use('/accounts', accountRoutes)

Router.use('/savings', savingRoutes)

Router.use('/accumulations', accumulationRoutes)

Router.use('/moneySources', moneySourceRoutes)

Router.use('/budgets', budgetRoutes)

Router.use('/families', familyRoutes)

Router.use('/contacts', contactRoutes)

Router.use('/banks', bankRoutes)

export const APIs = Router
