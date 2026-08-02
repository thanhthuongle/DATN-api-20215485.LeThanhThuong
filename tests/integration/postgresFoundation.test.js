import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { assertDisposableDatabaseUrl } from '../helpers/disposableDatabase'
import { startPostgresContainer } from '../helpers/containers'

vi.mock('~/agenda/agenda', () => ({ agenda: {} }))

const root = fileURLToPath(new URL('../..', import.meta.url))
const prismaCli = resolve(root, 'node_modules/prisma/build/index.js')

let postgres
let databaseUrl

beforeAll(async () => {
  postgres = await startPostgresContainer()
  databaseUrl = assertDisposableDatabaseUrl(postgres.getConnectionUri())
  process.env.POSTGRESQL_DATABASE_URL = databaseUrl
  process.env.POSTGRESQL_DIRECT_URL = databaseUrl

  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: root,
    env: {
      ...process.env,
      POSTGRESQL_DATABASE_URL: databaseUrl,
      POSTGRESQL_DIRECT_URL: databaseUrl
    },
    stdio: 'pipe'
  })
})

afterAll(async () => {
  const { disconnectPrisma } = await import('~/v2/infrastructure/database/prismaClient')
  await disconnectPrisma()
  await postgres?.stop()
})

describe('disposable PostgreSQL foundation', () => {
  it('builds the reviewed Wave 2 schema from clean migrations', async () => {
    vi.resetModules()
    const { getPrismaClient } = await import('~/v2/infrastructure/database/prismaClient')
    const prisma = getPrismaClient()
    const migrations = await prisma.$queryRaw`SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`
    const businessTables = await prisma.$queryRaw`
      SELECT count(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
    `
    const enums = await prisma.$queryRaw`
      SELECT count(*)::int AS count
      FROM pg_type type
      JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
      WHERE namespace.nspname = 'public' AND type.typtype = 'e'
    `
    const foreignKeys = await prisma.$queryRaw`
      SELECT count(*)::int AS count
      FROM pg_constraint constraint_row
      JOIN pg_namespace namespace ON namespace.oid = constraint_row.connamespace
      WHERE namespace.nspname = 'public' AND constraint_row.contype = 'f'
    `

    expect(migrations[0].count).toBe(2)
    expect(businessTables[0].count).toBe(45)
    expect(enums[0].count).toBe(52)
    expect(foreignKeys[0].count).toBe(105)
  })

  it('passes the production PostgreSQL health implementation', async () => {
    const { checkPostgresHealth } = await import('~/v2/infrastructure/database/postgresHealth')
    await expect(checkPostgresHealth()).resolves.toMatchObject({ status: 'ok' })
  })

  it('exposes PostgreSQL health through the V2 API boundary', async () => {
    const { default: request } = await import('supertest')
    const { createApplication } = await import('~/app')
    const response = await request(createApplication({ enableApiV2: true }))
      .get('/api/v2/health/postgres')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ status: 'ok', dependency: 'postgresql' })
    expect(response.headers['x-correlation-id']).toBeTruthy()
  })
})
