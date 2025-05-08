import express from 'express'
import { StatusCodes } from 'http-status-codes'
import { userRoutes } from './userRoutes'
import { transactionRoutes } from './transactionRoutes'

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

export const APIs = Router
