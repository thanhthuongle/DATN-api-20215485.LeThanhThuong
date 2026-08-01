const assert = require('node:assert/strict')
const http = require('node:http')

const agendaModulePath = require.resolve('../build/src/agenda/agenda')
require.cache[agendaModulePath] = {
  id: agendaModulePath,
  filename: agendaModulePath,
  loaded: true,
  exports: { agenda: {} }
}

const { createApplication } = require('../build/src/app')
const { v1Routes } = require('../build/src/api/v1')

const countRouteOperations = (router) => router.stack.reduce((total, layer) => {
  if (layer.route) {
    return total + Object.values(layer.route.methods).filter(Boolean).length
  }

  if (layer.handle?.stack) {
    return total + countRouteOperations(layer.handle)
  }

  return total
}, 0)

const withServer = async (app, callback) => {
  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

  try {
    const { port } = server.address()
    await callback(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

const readResponse = async (baseUrl, path) => {
  const response = await fetch(`${baseUrl}${path}`)
  return {
    status: response.status,
    cacheControl: response.headers.get('cache-control'),
    contentType: response.headers.get('content-type'),
    body: await response.text()
  }
}

const run = async () => {
  assert.equal(countRouteOperations(v1Routes), 55, 'V1 source operation baseline changed')

  const enabledApp = createApplication({ enableApiV2: true })
  const applicationRouter = enabledApp._router || enabledApp.router
  const v1Mounts = applicationRouter.stack.filter((layer) => layer.handle === v1Routes)
  assert.equal(v1Mounts.length, 2, 'The same V1 router must be mounted twice')

  await withServer(enabledApp, async (baseUrl) => {
    const legacyStatus = await readResponse(baseUrl, '/status')
    const versionedStatus = await readResponse(baseUrl, '/api/v1/status')

    assert.deepEqual(versionedStatus, legacyStatus, '/api/v1 status must match legacy status')
    assert.equal(legacyStatus.status, 200)
    assert.equal(legacyStatus.body, JSON.stringify({ message: 'APIs are ready to use' }))

    const health = await fetch(`${baseUrl}/api/v2/health`)
    const healthBody = await health.json()
    assert.equal(health.status, 200)
    assert.equal(healthBody.status, 'ok')
    assert.equal(healthBody.version, 'v2')
    assert.match(healthBody.timestamp, /^\d{4}-\d{2}-\d{2}T/)
  })

  await withServer(createApplication({ enableApiV2: false }), async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/v2/health`)
    assert.equal(health.status, 404, 'V2 must not mount when disabled')

    const legacyStatus = await readResponse(baseUrl, '/status')
    assert.equal(legacyStatus.status, 200, 'Disabling V2 must not disable V1')
  })

  process.stdout.write('Phase 1 API versioning verification PASS: 55 V1 operations, legacy parity, /api/v1 parity, V2 health gating.\n')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
