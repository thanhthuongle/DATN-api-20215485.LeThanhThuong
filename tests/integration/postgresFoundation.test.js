import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { assertDisposableDatabaseUrl } from '../helpers/disposableDatabase'
import { startPostgresContainer } from '../helpers/containers'

vi.mock('~/agenda/agenda', () => ({ agenda: {} }))

const root = fileURLToPath(new URL('../..', import.meta.url))
const prismaCli = resolve(root, 'node_modules/prisma/build/index.js')
const dryRunScript = resolve(root, 'scripts/run-wave2-controlled-dry-run.cjs')
const migrationEvidenceScript = resolve(root, 'scripts/verify-wave2-migration-evidence.cjs')
const privilegeVerificationScript = resolve(root, 'scripts/verify-postgresql-privileges.cjs')
const require = createRequire(import.meta.url)
const { provisionPostgresqlRoles } = require('../../scripts/postgresql-role-policy.cjs')
const applicationRole = 'wave2_test_application'
const applicationPassword = 'wave2_test_application_only'

let postgres
let databaseUrl
let applicationDatabaseUrl
let provisionedRoles

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

  const admin = new Client({ connectionString: databaseUrl })
  await admin.connect()
  try {
    await admin.query(`CREATE ROLE "${applicationRole}" LOGIN PASSWORD '${applicationPassword}'`)
  } finally {
    await admin.end()
  }
  const applicationUrl = new URL(databaseUrl)
  applicationUrl.username = applicationRole
  applicationUrl.password = applicationPassword
  applicationDatabaseUrl = applicationUrl.toString()
  provisionedRoles = await provisionPostgresqlRoles({
    directConnectionString: databaseUrl,
    applicationConnectionString: applicationDatabaseUrl
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
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
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

    expect(migrations[0].count).toBeGreaterThanOrEqual(6)
    expect(businessTables[0].count).toBe(45)
    expect(enums[0].count).toBe(52)
    expect(foreignKeys[0].count).toBe(105)
  })

  it('discovers distinct URL identities and provisions the application least-privilege role', async () => {
    const client = new Client({ connectionString: databaseUrl })
    await client.connect()
    try {
      const tablePrivilege = async (role, table, privilege) =>
        (await client.query('SELECT has_table_privilege($1,$2,$3) AS allowed', [role, `public.${table}`, privilege])).rows[0].allowed
      const schemaPrivilege = async (role, privilege) =>
        (await client.query('SELECT has_schema_privilege($1,\'public\',$2) AS allowed', [role, privilege])).rows[0].allowed
      const columnPrivilege = async (role, table, column, privilege) =>
        (await client.query('SELECT has_column_privilege($1,$2,$3,$4) AS allowed', [role, `public.${table}`, column, privilege])).rows[0].allowed

      expect(provisionedRoles.applicationRole).toBe(applicationRole)
      expect(provisionedRoles.migrationRole).not.toBe(applicationRole)
      await expect(tablePrivilege(applicationRole, 'financial_transactions', 'SELECT')).resolves.toBe(true)
      await expect(tablePrivilege(applicationRole, 'ledger_entries', 'INSERT')).resolves.toBe(true)
      await expect(tablePrivilege(applicationRole, 'ledger_entries', 'UPDATE')).resolves.toBe(false)
      await expect(tablePrivilege(applicationRole, 'migration_source_records', 'SELECT')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'ledger_accounts', 'name', 'INSERT')).resolves.toBe(true)
      await expect(columnPrivilege(applicationRole, 'ledger_accounts', 'current_balance', 'INSERT')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'ledger_accounts', 'status', 'UPDATE')).resolves.toBe(true)
      await expect(columnPrivilege(applicationRole, 'ledger_accounts', 'current_balance', 'UPDATE')).resolves.toBe(false)
      await expect(schemaPrivilege(applicationRole, 'USAGE')).resolves.toBe(true)
      await expect(schemaPrivilege(applicationRole, 'CREATE')).resolves.toBe(false)
      expect(() => execFileSync(process.execPath, [privilegeVerificationScript], {
        cwd: root,
        env: {
          ...process.env,
          POSTGRESQL_DATABASE_URL: applicationDatabaseUrl,
          POSTGRESQL_DIRECT_URL: databaseUrl
        },
        stdio: 'pipe'
      })).not.toThrow()
    } finally {
      await client.end()
    }
  })

  it('rejects provisioning when runtime and migration URLs authenticate as the same role', async () => {
    await expect(provisionPostgresqlRoles({
      directConnectionString: databaseUrl,
      applicationConnectionString: databaseUrl
    })).rejects.toThrow('must authenticate as distinct PostgreSQL roles')
  })

  it('produces the same database-derived dry-run hash on two clean databases', async () => {
    const runControlledDryRun = (connectionString) => {
      const env = {
        ...process.env,
        POSTGRESQL_DATABASE_URL: connectionString,
        POSTGRESQL_DIRECT_URL: connectionString
      }
      execFileSync(process.execPath, [prismaCli, 'db', 'seed'], { cwd: root, env, stdio: 'pipe' })
      const summary = JSON.parse(execFileSync(process.execPath, [dryRunScript], { cwd: root, env, stdio: 'pipe' }).toString())
      execFileSync(process.execPath, [migrationEvidenceScript], { cwd: root, env, stdio: 'pipe' })
      return summary
    }

    const first = runControlledDryRun(databaseUrl)
    const secondPostgres = await startPostgresContainer()
    try {
      const secondDatabaseUrl = assertDisposableDatabaseUrl(secondPostgres.getConnectionUri())
      execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
        cwd: root,
        env: {
          ...process.env,
          POSTGRESQL_DATABASE_URL: secondDatabaseUrl,
          POSTGRESQL_DIRECT_URL: secondDatabaseUrl
        },
        stdio: 'pipe'
      })
      const second = runControlledDryRun(secondDatabaseUrl)
      expect(second.sourceChecksum).toBe(first.sourceChecksum)
      expect(second.targetHash).toBe(first.targetHash)
      expect(first.targetTablesHashed).toBeGreaterThanOrEqual(17)
      expect(first.targetRowsHashed).toBeGreaterThan(first.sourceCount)
      expect(first.ledgerProjectionMismatches).toBe(0)
      process.stdout.write(
        `Wave 2 dry-run determinism PASS: target_hash=${first.targetHash}, tables=${first.targetTablesHashed}, rows=${first.targetRowsHashed}\n`
      )
    } finally {
      await secondPostgres.stop()
    }
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
