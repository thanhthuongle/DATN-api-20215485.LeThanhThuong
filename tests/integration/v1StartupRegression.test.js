import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startStandaloneMongoContainer } from '../helpers/containers'

const root = fileURLToPath(new URL('../..', import.meta.url))
const babelNode = resolve(root, 'node_modules/@babel/node/bin/babel-node.js')

let mongo
let serverProcess
let baseUrl
let serverOutput = ''

const reservePort = async () => {
  const server = createServer()
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
  const { port } = server.address()
  await new Promise((resolveClose) => server.close(resolveClose))
  return port
}

const waitForStatus = async (url, timeoutMs = 30000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`V1 exited before health check:\n${serverOutput}`)
    }

    try {
      const response = await fetch(`${url}/status`)
      if (response.status === 200) return response
    } catch (error) {
      if (!['ECONNREFUSED', 'fetch failed'].some((message) => error.message.includes(message))) throw error
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 200))
  }
  throw new Error(`Timed out waiting for V1 startup:\n${serverOutput}`)
}

beforeAll(async () => {
  mongo = await startStandaloneMongoContainer()
  const appPort = await reservePort()
  const mongoUri = `mongodb://127.0.0.1:${mongo.getMappedPort(27017)}`
  baseUrl = `http://127.0.0.1:${appPort}`

  serverProcess = spawn(process.execPath, [babelNode, '--extensions', '.js,.ts', 'src/server.js'], {
    cwd: root,
    env: {
      ...process.env,
      BUILD_MODE: 'dev',
      DEPLOYMENT_ENV: 'test',
      ENABLE_API_V2: 'false',
      MONGODB_URI_DEVELOPMENT: mongoUri,
      DATABASE_NAME: 'v1_startup_regression',
      LOCAL_DEV_APP_HOST: '127.0.0.1',
      LOCAL_DEV_APP_PORT: String(appPort),
      AUTHOR: 'Wave1 regression',
      CACHE_ENABLED: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  serverProcess.stdout.on('data', (chunk) => { serverOutput += chunk.toString() })
  serverProcess.stderr.on('data', (chunk) => { serverOutput += chunk.toString() })
  await waitForStatus(baseUrl)
})

afterAll(async () => {
  if (serverProcess?.exitCode === null) {
    serverProcess.kill()
    await Promise.race([
      once(serverProcess, 'exit'),
      new Promise((resolveWait) => setTimeout(resolveWait, 10000))
    ])
  }
  await mongo?.stop()
})

describe('V1 startup regression', () => {
  it('starts against disposable MongoDB and serves legacy plus /api/v1 status', async () => {
    const [legacy, versioned] = await Promise.all([
      fetch(`${baseUrl}/status`),
      fetch(`${baseUrl}/api/v1/status`)
    ])
    expect(legacy.status).toBe(200)
    expect(versioned.status).toBe(200)
    expect(await versioned.json()).toEqual(await legacy.json())
  })

  it('keeps V2 disabled by default', async () => {
    const response = await fetch(`${baseUrl}/api/v2/health`)
    expect(response.status).toBe(404)
  })
})
