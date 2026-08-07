/* eslint-disable no-console */
import exitHook from 'async-exit-hook'
import { CONNECT_DB, CLOSE_DB } from '~/config/mongodb'
import { env } from '~/config/environment'
import { corsOptions } from './config/cors'
import { seedBanksIfEmpty } from '~/utils/seedBanks'
import { agenda } from '~/agenda/agenda'
import { loadSystemTasks } from '~/agenda/loadSystemTasks'
import http from 'http'
import { initSocketServer } from './sockets'
import { initializeCacheClient } from '~/utils/cache/cacheClient'
import { createApplication } from './app'

import { startV2Workers } from '~/v2/infrastructure/bootstrap/v2WorkerBootstrap'

let v2WorkerBootstrap = null


const START_SERVER = () => {
  const app = createApplication()
  const server = http.createServer(app)
  initSocketServer(server, corsOptions)

  if (env.BUILD_MODE === 'production') {
    server.listen(process.env.PORT, async () => {
      console.log(`5. Hello ${env.AUTHOR}, Server is running at Port: ${process.env.PORT}/`)
    })
  } else {
    // Môi trường local dev
    server.listen(env.LOCAL_DEV_APP_PORT, env.LOCAL_DEV_APP_HOST, async () => {
      console.log(`5. Hello ${env.AUTHOR}, Server is running at http://${env.LOCAL_DEV_APP_HOST}:${env.LOCAL_DEV_APP_PORT}/`)
    })
  }

  exitHook(async () => {
    console.log('6. Server is shutting down...')
    await agenda.stop()
    if (v2WorkerBootstrap) {
      await v2WorkerBootstrap.stop()
      console.log('6b. V2 workers stopped.')
    }
    CLOSE_DB()
    console.log('7. DisConnected from MongoDB Cloud Atlas...')
  })
}

(async () => {
  try {
    console.log('1. Connecting to MongoDB...')
    await CONNECT_DB()
    console.log('2. Connected to MongoDB')

    // ✅ init cache client
    if (env.CACHE_ENABLED) {
      await initializeCacheClient()
    }

    // ✅ seedbank
    seedBanksIfEmpty()

    // ✅ init agenda
    console.log('3. Initializing Agenda...')
    // await agenda.mongo(GET_DB(), 'system_tasks')
    loadSystemTasks(agenda)
    await agenda.start()
    console.log('4. Agenda started.')

    v2WorkerBootstrap = await startV2Workers()
    console.log('4b. V2 workers started.')

    START_SERVER()
  } catch (error) {
    console.error(error)
    process.exit(0)
  }
})()
