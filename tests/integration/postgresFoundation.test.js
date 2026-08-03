import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
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
const schemaVerificationScript = resolve(root, 'scripts/verify-wave2-schema.cjs')
const financialGuardsScript = resolve(root, 'scripts/verify-wave2-financial-guards.cjs')
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
    const triggers = await prisma.$queryRaw`
      SELECT count(*)::int AS count
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
    `

    expect(migrations[0].count).toBeGreaterThanOrEqual(8)
    expect(businessTables[0].count).toBe(45)
    expect(enums[0].count).toBe(52)
    expect(foreignKeys[0].count).toBe(105)
    expect(triggers[0].count).toBe(108)
    process.stdout.write(`Wave 2 trigger count: ${triggers[0].count}\n`)
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
      await expect(tablePrivilege(applicationRole, 'ledger_entries', 'INSERT')).resolves.toBe(false)
      await expect(tablePrivilege(applicationRole, 'ledger_entries', 'UPDATE')).resolves.toBe(false)
      await expect(tablePrivilege(applicationRole, 'migration_source_records', 'SELECT')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'ledger_accounts', 'name', 'INSERT')).resolves.toBe(true)
      await expect(columnPrivilege(applicationRole, 'ledger_accounts', 'public_id', 'INSERT')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'ledger_accounts', 'created_at', 'INSERT')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'ledger_accounts', 'updated_at', 'INSERT')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'ledger_accounts', 'current_balance', 'INSERT')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'ledger_accounts', 'status', 'UPDATE')).resolves.toBe(true)
      await expect(columnPrivilege(applicationRole, 'ledger_accounts', 'current_balance', 'UPDATE')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'ledger_entries', 'financial_transaction_id', 'INSERT')).resolves.toBe(true)
      await expect(columnPrivilege(applicationRole, 'ledger_entries', 'public_id', 'INSERT')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'debt_agreements', 'status', 'INSERT')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'debt_agreements', 'outstanding_principal', 'INSERT')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'debt_agreements', 'outstanding_interest', 'INSERT')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'debt_agreements', 'settled_at', 'INSERT')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'idempotency_records', 'request_hash', 'UPDATE')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'outbox_events', 'payload', 'UPDATE')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'interspace_transfer_groups', 'source_transaction_id', 'UPDATE')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'financial_space_memberships', 'financial_space_id', 'UPDATE')).resolves.toBe(false)
      await expect(tablePrivilege(applicationRole, 'accounts', 'UPDATE')).resolves.toBe(false)
      await expect(tablePrivilege(applicationRole, 'savings_accounts', 'UPDATE')).resolves.toBe(false)
      await expect(tablePrivilege(applicationRole, 'temporary_assets', 'DELETE')).resolves.toBe(false)
      await expect(tablePrivilege(applicationRole, 'account_balance_snapshots', 'INSERT')).resolves.toBe(false)
      await expect(tablePrivilege(applicationRole, 'balance_snapshot_runs', 'INSERT')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'accounts', 'name', 'UPDATE')).resolves.toBe(true)
      await expect(columnPrivilege(applicationRole, 'accounts', 'legacy_stored_balance', 'UPDATE')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'savings_accounts', 'annual_rate', 'UPDATE')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'attachments', 'linked_by_user_id', 'UPDATE')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'temporary_assets', 'source_provenance', 'UPDATE')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'users', 'public_id', 'UPDATE')).resolves.toBe(false)
      await expect(columnPrivilege(applicationRole, 'users', 'created_at', 'UPDATE')).resolves.toBe(false)
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

      const applicationClient = new Client({ connectionString: applicationDatabaseUrl })
      await applicationClient.connect()
      try {
        await expect(applicationClient.query('UPDATE financial_transactions SET amount=amount')).rejects.toMatchObject({ code: '42501' })
        await expect(applicationClient.query('UPDATE idempotency_records SET request_hash=request_hash')).rejects.toMatchObject({ code: '42501' })
        await expect(applicationClient.query('UPDATE outbox_events SET payload=payload')).rejects.toMatchObject({ code: '42501' })
        await expect(applicationClient.query('UPDATE financial_space_memberships SET financial_space_id=financial_space_id')).rejects.toMatchObject({ code: '42501' })
        await expect(applicationClient.query('UPDATE accounts SET legacy_stored_balance=legacy_stored_balance')).rejects.toMatchObject({ code: '42501' })
        await expect(applicationClient.query('UPDATE savings_accounts SET annual_rate=annual_rate')).rejects.toMatchObject({ code: '42501' })
        await expect(applicationClient.query('UPDATE attachments SET linked_by_user_id=linked_by_user_id')).rejects.toMatchObject({ code: '42501' })
        await expect(applicationClient.query('UPDATE temporary_assets SET source_provenance=source_provenance')).rejects.toMatchObject({ code: '42501' })
        await expect(applicationClient.query('UPDATE users SET created_at=created_at')).rejects.toMatchObject({ code: '42501' })
        await expect(applicationClient.query(`INSERT INTO debt_agreements (status) VALUES ('OPEN')`)).rejects.toMatchObject({ code: '42501' })
        await expect(applicationClient.query('DELETE FROM temporary_assets')).rejects.toMatchObject({ code: '42501' })
        await expect(applicationClient.query('INSERT INTO balance_snapshot_runs DEFAULT VALUES')).rejects.toMatchObject({ code: '42501' })
      } finally {
        await applicationClient.end()
      }
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

  it('refuses financial guard writes without a matching disposable database marker', async () => {
    const client = new Client({ connectionString: databaseUrl })
    await client.connect()
    try {
      const before = Number((await client.query('SELECT count(*) FROM users')).rows[0].count)
      expect(() => execFileSync(process.execPath, [financialGuardsScript], {
        cwd: root,
        env: { ...process.env, POSTGRESQL_DIRECT_URL: databaseUrl, WAVE2_DISPOSABLE_DATABASE_TOKEN: randomUUID() },
        stdio: 'pipe'
      })).toThrow()
      const after = Number((await client.query('SELECT count(*) FROM users')).rows[0].count)
      expect(after).toBe(before)
    } finally {
      await client.end()
    }
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
      execFileSync(process.execPath, [schemaVerificationScript], { cwd: root, env, stdio: 'pipe' })
      return summary
    }

    const runFinancialGuards = async (connectionString) => {
      const markerToken = randomUUID()
      const client = new Client({ connectionString })
      await client.connect()
      try {
        await client.query(`
          CREATE TABLE wave2_disposable_database_markers (
            token uuid PRIMARY KEY,
            database_name text NOT NULL,
            database_owner name NOT NULL,
            purpose text NOT NULL CHECK (purpose='WAVE2_FINANCIAL_GUARDS'),
            expires_at timestamptz NOT NULL
          )
        `)
        await client.query(
          `INSERT INTO wave2_disposable_database_markers (token,database_name,database_owner,purpose,expires_at)
           VALUES ($1,current_database(),current_user,'WAVE2_FINANCIAL_GUARDS',clock_timestamp()+interval '1 hour')`,
          [markerToken]
        )
      } finally {
        await client.end()
      }
      execFileSync(process.execPath, [financialGuardsScript], {
        cwd: root,
        env: { ...process.env, POSTGRESQL_DIRECT_URL: connectionString, WAVE2_DISPOSABLE_DATABASE_TOKEN: markerToken },
        stdio: 'pipe'
      })
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
      await runFinancialGuards(secondDatabaseUrl)
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
