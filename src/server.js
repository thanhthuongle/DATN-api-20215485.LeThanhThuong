import express from 'express'
import exitHook from 'async-exit-hook'
import { CONNECT_DB, CLOSE_DB } from '~/config/mongodb'
import { env } from '~/config/environment'
import { APIs } from './routes'
import { errorHandlingMiddleware } from './middlewares/errorHandlingMiddleware'

const START_SERVER = () => {
  const app = express()

  app.use(express.json())

  app.use(express.urlencoded({
    extended: true
  }))

  app.use('/', APIs)

  app.use(errorHandlingMiddleware)

  app.listen(env.APP_PORT, env.APP_HOST, async () => {
    // eslint-disable-next-line no-console
    console.log(`3. Hello ${env.AUTHOR}, Server is running at http://${ env.APP_HOST }:${ env.APP_PORT }/`)
  })

  exitHook(() => {
    // eslint-disable-next-line no-console
    console.log('4. Server is shutting down...')
    CLOSE_DB()
    // eslint-disable-next-line no-console
    console.log('5. DisConnected from MongoDB Cloud Atlas...')
  })
}

(async () => {
  try {
    // eslint-disable-next-line no-console
    console.log('1. Connecting to MongoDB Cloud Atlas...')
    await CONNECT_DB()
    // eslint-disable-next-line no-console
    console.log('2. Connected to MongoDB Cloud Atlas')
    START_SERVER()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    process.exit(0)
  }
})()
