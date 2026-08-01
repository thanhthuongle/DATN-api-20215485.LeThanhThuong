import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

vi.mock('~/agenda/agenda', () => ({ agenda: {} }))

const { createApplication } = await import('~/app')
const { v1Routes } = await import('~/api/v1')

const countRouteOperations = (router) => router.stack.reduce((total, layer) => {
  if (layer.route) {
    return total + Object.values(layer.route.methods).filter(Boolean).length
  }

  return total + (layer.handle?.stack ? countRouteOperations(layer.handle) : 0)
}, 0)

describe('API versioning compatibility', () => {
  it('mounts all 55 V1 operations and keeps status parity', async () => {
    const app = createApplication({ enableApiV2: true })
    expect(countRouteOperations(v1Routes)).toBe(55)

    const [legacy, versioned] = await Promise.all([
      request(app).get('/status'),
      request(app).get('/api/v1/status')
    ])

    expect(versioned.status).toBe(legacy.status)
    expect(versioned.body).toEqual(legacy.body)
    expect(versioned.headers['cache-control']).toBe(legacy.headers['cache-control'])
    expect(versioned.headers['content-type']).toBe(legacy.headers['content-type'])
  })

  it('mounts V2 health only when enabled', async () => {
    const enabled = await request(createApplication({ enableApiV2: true }))
      .get('/api/v2/health')
      .set('X-Correlation-Id', 'phase2-contract-123')
    expect(enabled.status).toBe(200)
    expect(enabled.body).toMatchObject({ status: 'ok', version: 'v2' })
    expect(enabled.headers['x-correlation-id']).toBe('phase2-contract-123')

    const disabled = await request(createApplication({ enableApiV2: false })).get('/api/v2/health')
    expect(disabled.status).toBe(404)
  })
})
