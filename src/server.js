/* eslint-disable no-console */
import express from 'express'
import exitHook from 'async-exit-hook'
import { CONNECT_DB, CLOSE_DB } from '~/config/mongodb'
import { env } from '~/config/environment'
import { APIs } from './routes'
import { errorHandlingMiddleware } from './middlewares/errorHandlingMiddleware'
import cors from 'cors'
import { corsOptions } from './config/cors'
import { seedBanksIfEmpty } from '~/utils/seedBanks'
import cookieParser from 'cookie-parser'
import { agenda } from '~/agenda/agenda'
import { loadSystemTasks } from '~/agenda/loadSystemTasks'
import http from 'http'
import { initSocketServer } from './sockets'

const START_SERVER = () => {
  const app = express()

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

  app.use('/', APIs)

  app.use(errorHandlingMiddleware)

  const server = http.createServer(app)
  initSocketServer(server, corsOptions)

  if (env.BUILD_MODE === 'production') {
    server.listen(process.env.PORT, async () => {
      // eslint-disable-next-line no-console
      console.log(`5. Hello ${env.AUTHOR}, Server is running at Port: ${process.env.PORT }/`)
    })
  } else {
    // Môi trường local dev
    server.listen(env.LOCAL_DEV_APP_PORT, env.LOCAL_DEV_APP_HOST, async () => {
      // eslint-disable-next-line no-console
      console.log(`5. Hello ${env.AUTHOR}, Server is running at http://${ env.LOCAL_DEV_APP_HOST }:${ env.LOCAL_DEV_APP_PORT }/`)
    })
  }

  // (async function () {
  //   const userId = '684ff408188164f20cece9b6'
  //   const jobName = `remider-note-${userId}`
  //   await agenda.now('send remider', { userId: '684ff408188164f20cece9b6', title: 'Test thông báo tự động', message: 'Tin nhắn thông báo tự động' }, { name: `remider-note-${userId}` })
  //   await agenda.every('1 minutes', 'send remider', { userId: '684ff408188164f20cece9b6', title: 'Test thông báo tự động', message: 'Tin nhắn thông báo tụ động mỗi 1 phút này' }, { name: `remider-note-${userId}` })
  //   await agenda.cancel({ 'data.userId': '684ff408188164f20cece9b6' })
  //   const newJob = agenda.create('send remider', { userId: '684ff408188164f20cece9b6', title: 'Test thông báo tự động', message: 'Tin nhắn thông báo tự động' })
  //   newJob.attrs.name = jobName
  //   newJob.schedule(new Date())
  //   await newJob.save()
  // })()

  exitHook(async () => {
    // eslint-disable-next-line no-console
    console.log('6. Server is shutting down...')
    await agenda.stop()
    CLOSE_DB()
    // eslint-disable-next-line no-console
    console.log('7. DisConnected from MongoDB Cloud Atlas...')
  })
}

(async () => {
  try {
    // eslint-disable-next-line no-console
    console.log('1. Connecting to MongoDB...')
    await CONNECT_DB()
    // eslint-disable-next-line no-console
    console.log('2. Connected to MongoDB')

    // ✅ seedbank
    seedBanksIfEmpty()

    // ✅ init agenda
    console.log('3. Initializing Agenda...')
    // await agenda.mongo(GET_DB(), 'system_tasks')
    loadSystemTasks(agenda)
    await agenda.start()
    console.log('4. Agenda started.')

    START_SERVER()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    process.exit(0)
  }
})()
