import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockResponse = () => {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.send = vi.fn(() => res)
  return res
}

const mockMigrationAdminService = {
  listRuns: vi.fn(),
  getRun: vi.fn(),
  listDiscrepancies: vi.fn(),
  resolveDiscrepancy: vi.fn()
}

const mockMappers = {
  toMigrationRunListResponse: vi.fn((runs) => runs),
  toMigrationRunResponse: vi.fn((run) => run),
  toDiscrepancyListResponse: vi.fn((discs) => discs),
  toDiscrepancyResponse: vi.fn((disc) => disc)
}

vi.mock('~/v2/modules/migration/services/migrationAdmin.service', () => ({
  __esModule: true,
  default: mockMigrationAdminService
}))

vi.mock('../../../src/api/v2/mappers/migrationMapper', () => ({
  toMigrationRunListResponse: (...args) => mockMappers.toMigrationRunListResponse(...args),
  toMigrationRunResponse: (...args) => mockMappers.toMigrationRunResponse(...args),
  toDiscrepancyListResponse: (...args) => mockMappers.toDiscrepancyListResponse(...args),
  toDiscrepancyResponse: (...args) => mockMappers.toDiscrepancyResponse(...args)
}))

const {
  listMigrationRuns,
  getMigrationRun,
  listDiscrepancies,
  resolveDiscrepancy
} = await import('../../../src/api/v2/controllers/migrationAdminController')

describe('migrationAdminController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listMigrationRuns', () => {
    it('returns a list of migration runs', async () => {
      const runs = [{ id: 1, status: 'COMPLETED' }]
      mockMappers.toMigrationRunListResponse.mockReturnValue(runs)
      mockMigrationAdminService.listRuns.mockResolvedValue(runs)
      const req = { query: {} }
      const res = mockResponse()
      const next = vi.fn()
      await listMigrationRuns(req, res, next)
      expect(mockMigrationAdminService.listRuns).toHaveBeenCalledWith({})
      expect(res.json).toHaveBeenCalledWith({ data: runs })
    })

    it('passes query parameters to the service', async () => {
      const req = { query: { status: 'COMPLETED', limit: '10' } }
      const res = mockResponse()
      const next = vi.fn()
      await listMigrationRuns(req, res, next)
      expect(mockMigrationAdminService.listRuns).toHaveBeenCalledWith({
        status: 'COMPLETED',
        limit: 10
      })
    })
  })

  describe('getMigrationRun', () => {
    it('returns a single migration run by id', async () => {
      const run = { id: 1, status: 'COMPLETED' }
      mockMappers.toMigrationRunResponse.mockReturnValue(run)
      mockMigrationAdminService.getRun.mockResolvedValue(run)
      const req = { params: { id: '1' } }
      const res = mockResponse()
      const next = vi.fn()
      await getMigrationRun(req, res, next)
      expect(mockMigrationAdminService.getRun).toHaveBeenCalledWith(1)
      expect(res.json).toHaveBeenCalledWith({ data: run })
    })

    it('returns 404 when run is not found', async () => {
      mockMigrationAdminService.getRun.mockResolvedValue(null)
      const req = { params: { id: '999' } }
      const res = mockResponse()
      const next = vi.fn()
      await getMigrationRun(req, res, next)
      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ statusCode: 404, message: 'Migration run not found' })
    })
  })

  describe('listDiscrepancies', () => {
    it('returns a list of discrepancies', async () => {
      const discrepancies = [{ publicId: 'disc-1', status: 'OPEN' }]
      mockMappers.toDiscrepancyListResponse.mockReturnValue(discrepancies)
      mockMigrationAdminService.listDiscrepancies.mockResolvedValue(discrepancies)
      const req = { query: {} }
      const res = mockResponse()
      const next = vi.fn()
      await listDiscrepancies(req, res, next)
      expect(mockMigrationAdminService.listDiscrepancies).toHaveBeenCalledWith({})
      expect(res.json).toHaveBeenCalledWith({ data: discrepancies })
    })

    it('passes filter parameters to the service', async () => {
      const req = { query: { status: 'OPEN', severity: 'BLOCKING' } }
      const res = mockResponse()
      const next = vi.fn()
      await listDiscrepancies(req, res, next)
      expect(mockMigrationAdminService.listDiscrepancies).toHaveBeenCalledWith({
        status: 'OPEN',
        severity: 'BLOCKING'
      })
    })
  })

  describe('resolveDiscrepancy', () => {
    it('resolves a discrepancy and returns the result', async () => {
      const result = { publicId: 'disc-1', status: 'RESOLVED' }
      mockMappers.toDiscrepancyResponse.mockReturnValue(result)
      mockMigrationAdminService.resolveDiscrepancy.mockResolvedValue(result)
      const req = {
        params: { publicId: 'disc-1' },
        body: { resolutionNote: 'Fixed', resolutionAction: 'ACCEPT' }
      }
      const res = mockResponse()
      const next = vi.fn()
      await resolveDiscrepancy(req, res, next)
      expect(mockMigrationAdminService.resolveDiscrepancy).toHaveBeenCalledWith({
        publicId: 'disc-1',
        resolutionNote: 'Fixed',
        resolvedByUserId: null,
        resolutionAction: 'ACCEPT'
      })
      expect(res.json).toHaveBeenCalledWith({ data: result })
    })

    it('returns 404 when discrepancy is not found', async () => {
      mockMigrationAdminService.resolveDiscrepancy.mockResolvedValue(null)
      const req = {
        params: { publicId: 'nonexistent' },
        body: { resolutionNote: 'Fixed' }
      }
      const res = mockResponse()
      const next = vi.fn()
      await resolveDiscrepancy(req, res, next)
      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ statusCode: 404, message: 'Discrepancy not found' })
    })
  })
})