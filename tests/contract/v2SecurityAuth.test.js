import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

vi.mock('~/agenda/agenda', () => ({ agenda: {} }))

const { createApplication } = await import('~/app')

/**
 * Wave 7 (Phase 11) security gate — verifies that endpoints previously exposed
 * without authentication now reject unauthenticated requests at the HTTP
 * boundary (401) BEFORE reaching any controller/service.
 *
 * These are truthful auth-boundary tests: the auth middleware rejects on a
 * missing token cookie and never calls the underlying service, so the 401 is
 * produced without needing DB-backed service mocks.
 */
describe('V2 security gate: unauthenticated requests are rejected', () => {
  const app = createApplication({ enableApiV2: true })

  it('rejects unauthenticated budget list (W5-02)', async () => {
    const res = await request(app).get('/api/v2/spaces/1/budgets')
    expect(res.status).toBe(401)
  })

  it('rejects unauthenticated budget creation (W5-02)', async () => {
    const res = await request(app)
      .post('/api/v2/spaces/1/budgets')
      .send({ categoryId: '1', categoryName: 'Food', amount: '10000' })
    expect(res.status).toBe(401)
  })

  it('rejects unauthenticated notification list (W5-02)', async () => {
    const res = await request(app).get('/api/v2/notifications')
    expect(res.status).toBe(401)
  })

  it('rejects unauthenticated notification read (W5-02)', async () => {
    const res = await request(app).put('/api/v2/notifications/abc')
    expect(res.status).toBe(401)
  })

  it('rejects unauthenticated migration admin run list (P0)', async () => {
    const res = await request(app).get('/api/v2/admin/migration/runs')
    expect(res.status).toBe(401)
  })

  it('rejects unauthenticated migration admin discrepancy resolve (P0)', async () => {
    const res = await request(app)
      .patch('/api/v2/admin/discrepancies/disc-1/resolve')
      .send({ resolutionNote: 'x' })
    expect(res.status).toBe(401)
  })
})
