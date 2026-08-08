import express from 'express'
import { CONNECT_DB, CLOSE_DB } from '~/config/mongodb'
import { env } from '~/config/environment'
import { createAPIs } from './routes'
import { errorHandlingMiddleware } from './middlewares/errorHandlingMiddleware'
import cors from 'cors'
import { corsOptions } from './config/cors'
import { seedBanksIfEmpty } from '~/utils/seedBanks'
import cookieParser from 'cookie-parser'
import { agenda } from '~/agenda/agenda'
import { loadSystemTasks } from '~/agenda/loadSystemTasks'
import http from 'http'
import { initSocketServer } from './sockets'
import { initializeCacheClient } from '~/utils/cache/cacheClient'
import { cacheStatsMiddleware } from '~/middlewares/cacheStatsMiddleware'
import qs from 'qs'
import { SHUTDOWN_TIMEOUT_MS } from './utils/constants'

let httpServer = null
let ioServer = null
let isShuttingDown = false
let isReady = false

const START_SERVER = () => {
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

  app.use('/', createAPIs({ isReady: () => isReady, isShuttingDown: () => isShuttingDown }))

  app.use(errorHandlingMiddleware)

  httpServer = http.createServer(app)
  ioServer = initSocketServer(httpServer, corsOptions)

  return new Promise((resolve, reject) => {
    httpServer.once('error', reject)

    const onListening = () => {
      httpServer.off('error', reject)
      resolve()
    }

    if (env.BUILD_MODE === 'production') {
      httpServer.listen(process.env.PORT, () => {
        console.info(`5. Hello ${env.AUTHOR}, Server is running at Port: ${process.env.PORT}/`)
        onListening()
      })
    } else {
      // Môi trường local dev
      httpServer.listen(env.LOCAL_DEV_APP_PORT, env.LOCAL_DEV_APP_HOST, () => {
        console.info(`5. Hello ${env.AUTHOR}, Server is running at http://${env.LOCAL_DEV_APP_HOST}:${env.LOCAL_DEV_APP_PORT}/`)
        onListening()
      })
    }
  })
}

const closeHttpServer = () => {
  if (!httpServer) return Promise.resolve()

  return new Promise((resolve, reject) => {
    httpServer.close((error) => {
      if (error) return reject(error)
      resolve()
    })
  })
}

const closeSocketServer = () => {
  if (!ioServer) return Promise.resolve()

  return new Promise((resolve) => {
    ioServer.close(() => resolve())
  })
}

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return

  isShuttingDown = true
  isReady = false

  console.info(`Received ${signal}. Starting graceful shutdown...`)

  const forceExitTimer = setTimeout(() => {
    console.error('Graceful shutdown timed out. Forcing exit.')
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS)

  forceExitTimer.unref()

  try {
    // Bắt đầu ngừng nhận HTTP request mới.
    const httpClosing = closeHttpServer()

    // Đóng các WebSocket connection hiện tại.
    await closeSocketServer()

    // Chờ HTTP request đang chạy kết thúc.
    await httpClosing

    // Ngừng nhận và xử lý Agenda jobs.
    await agenda.stop()

    // Đóng MongoDB sau cùng vì request/job có thể còn cần database.
    await CLOSE_DB()

    clearTimeout(forceExitTimer)

    console.info('Graceful shutdown completed.')
    process.exit(0)
  } catch (error) {
    clearTimeout(forceExitTimer)
    console.error('Graceful shutdown failed:', error)
    process.exit(1)
  }
}

(async () => {
  try {
    console.info('1. Connecting to MongoDB...')
    await CONNECT_DB()
    console.info('2. Connected to MongoDB')

    // ✅ init cache client
    if (env.CACHE_ENABLED) {
      await initializeCacheClient()
    }

    // ✅ seedbank
    seedBanksIfEmpty()

    // ✅ init agenda
    console.info('3. Initializing Agenda...')
    // await agenda.mongo(GET_DB(), 'system_tasks')
    loadSystemTasks(agenda)
    await agenda.start()
    console.info('4. Agenda started.')

    await START_SERVER()

    isReady = true

    process.once('SIGTERM', () => {
      void gracefulShutdown('SIGTERM')
    })

    process.once('SIGINT', () => {
      void gracefulShutdown('SIGINT')
    })
  } catch (error) {
    console.error('Application startup failed:', error)

    try {
      await agenda.stop()
      console.info('Agenda stopped.')
    } catch (shutdownError) {
      console.error('Failed to stop Agenda:', shutdownError)
    }

    try {
      await CLOSE_DB()
      console.info('Disconnected from MongoDB.')
    } catch (shutdownError) {
      console.error('Failed to close MongoDB:', shutdownError)
    }

    process.exit(1)
  }
})()
