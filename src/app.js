import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import qs from 'qs'
import { env } from '~/config/environment'
import { corsOptions } from '~/config/cors'
import { errorHandlingMiddleware } from '~/middlewares/errorHandlingMiddleware'
import { cacheStatsMiddleware } from '~/middlewares/cacheStatsMiddleware'
import { v1Routes } from '~/api/v1'
import { v2Routes } from '~/api/v2'

export const createApplication = ({ enableApiV2 = env.ENABLE_API_V2 } = {}) => {
  const app = express()

  app.set('query parser', str => qs.parse(str))

  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  app.use(cookieParser())
  app.use(cors(corsOptions))
  app.use(express.json())
  app.use(express.urlencoded({
    extended: true
  }))
  app.use(cacheStatsMiddleware)

  if (enableApiV2) {
    app.use('/api/v2', v2Routes)
  }

  app.use('/api/v1', v1Routes)
  app.use('/', v1Routes)

  app.use(errorHandlingMiddleware)

  return app
}
