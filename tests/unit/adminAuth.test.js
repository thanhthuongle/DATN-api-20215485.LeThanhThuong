import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StatusCodes } from 'http-status-codes'

const { adminAuthMiddleware } = await import('../../src/api/v2/middlewares/adminAuth')

const mockResponse = () => {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.send = vi.fn(() => res)
  return res
}

describe('adminAuth middleware (deny-by-default guard)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('rejects when no authenticated session is present (before authMiddleware)', () => {
    const req = {}
    const res = mockResponse()
    const next = vi.fn()
    adminAuthMiddleware.isAdmin(req, res, next)
    const err = next.mock.calls[0][0]
    expect(err.statusCode || err.status).toBe(StatusCodes.UNAUTHORIZED)
    expect(err.message).toMatch(/authentication|required/i)
  })

  it('allows an authenticated admin through', () => {
    const req = { jwtDecoded: { sub: 'u-1', role: 'admin' } }
    const res = mockResponse()
    const next = vi.fn()
    adminAuthMiddleware.isAdmin(req, res, next)
    expect(next).toHaveBeenCalledWith()
  })

  it('denies a non-admin in production with 403', () => {
    const env = { ...process.env, BUILD_MODE: 'production' }
    vi.spyOn(process, 'env', 'get').mockReturnValue(env)
    const req = { jwtDecoded: { sub: 'u-2', role: 'user' } }
    const res = mockResponse()
    const next = vi.fn()
    adminAuthMiddleware.isAdmin(req, res, next)
    const err = next.mock.calls[0][0]
    expect(err.statusCode || err.status).toBe(StatusCodes.FORBIDDEN)
    expect(err.message).toMatch(/admin access required/i)
  })

  it('lets a non-admin through in non-production with a warning (dev/staging behavior)', () => {
    const env = { ...process.env, BUILD_MODE: 'dev' }
    vi.spyOn(process, 'env', 'get').mockReturnValue(env)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const req = { jwtDecoded: { sub: 'u-3', role: 'user' } }
    const res = mockResponse()
    const next = vi.fn()
    adminAuthMiddleware.isAdmin(req, res, next)
    expect(next).toHaveBeenCalledWith()
    expect(warnSpy).toHaveBeenCalled()
  })
})
