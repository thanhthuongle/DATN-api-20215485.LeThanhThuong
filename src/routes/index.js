import express from 'express'
import { StatusCodes } from 'http-status-codes'
import { userRoutes } from './userRoutes'

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

export const APIs = Router
