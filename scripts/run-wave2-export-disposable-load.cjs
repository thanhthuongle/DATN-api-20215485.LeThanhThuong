#!/usr/bin/env node

const { execFileSync } = require('node:child_process')
const { randomUUID } = require('node:crypto')
const path = require('node:path')
const { Client } = require('pg')
const reader = require('./lib/wave2-export-reader.cjs')
const { sanitizeExportSnapshot } = require('./lib/wave2-export-sanitizer.cjs')
const { buildWave2TransformPlan } = require('./lib/wave2-export-transform.cjs')
const { buildWave2IdentitySpacePlan } = require('./lib/wave2-identity-space-plan.cjs')
const {
  assertDisposableUrl,
  createTestcontainerCapability,
  loadWave2Export
} = require('./lib/wave2-export-postgresql-loader.cjs')

const EXPORT_DIRECTORY = path.resolve('D:\\Sghb\\mongodb-heymoney-data\\Heymoney-Data')
const EXPECTED_AGGREGATE = 'a7bbcdf03dc93eef67597e4c503efaa2b0a4fb91fc62f10b7dd727f0f01a0769'

const migrateAndSeedTwice = (connectionString) => {
  const root = path.resolve(__dirname, '..')
  const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js')
  const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const env = { ...process.env, POSTGRESQL_DIRECT_URL: connectionString, POSTGRESQL_DATABASE_URL: connectionString }
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], { cwd: root, env, stdio: 'pipe' })
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], { cwd: root, env, stdio: 'pipe' })
  execFileSync(process.execPath, [tsxCli, 'prisma/seed.ts'], { cwd: root, env, stdio: 'pipe' })
  execFileSync(process.execPath, [tsxCli, 'prisma/seed.ts'], { cwd: root, env, stdio: 'pipe' })
}

const createMarker = async (connectionString, token) => {
  const client = new Client({ connectionString })
  await client.connect()
  try {
    await client.query(`CREATE TABLE wave2_disposable_database_markers (
      token uuid PRIMARY KEY, database_name text NOT NULL, database_owner name NOT NULL,
      purpose text NOT NULL CHECK (purpose='WAVE2_EXPORT_LOAD'), expires_at timestamptz NOT NULL
    )`)
    await client.query(`INSERT INTO wave2_disposable_database_markers
      (token,database_name,database_owner,purpose,expires_at)
      VALUES ($1,current_database(),current_user,'WAVE2_EXPORT_LOAD',clock_timestamp()+interval '1 hour')`, [token])
  } finally {
    await client.end()
  }
}

const assertEmptyBeforeMigration = async (connectionString) => {
  const client = new Client({ connectionString })
  await client.connect()
  try {
    const publicTables = await client.query('SELECT tablename FROM pg_tables WHERE schemaname=\'public\' ORDER BY tablename')
    if (publicTables.rowCount !== 0) throw new Error('CLEAN_EMPTY_DISPOSABLE_DATABASE_REQUIRED_BEFORE_MIGRATION')
  } finally {
    await client.end()
  }
}

const runOnDatabase = async (connectionString, testcontainerCapability, { verifyAvatarReplayDrift = false } = {}) => {
  assertDisposableUrl(connectionString)
  const markerToken = randomUUID()
  await assertEmptyBeforeMigration(connectionString)
  migrateAndSeedTwice(connectionString)
  await createMarker(connectionString, markerToken)
  const sanitizedSnapshot = sanitizeExportSnapshot(reader.inspectExportDirectory({
    directory: EXPORT_DIRECTORY,
    absentCollections: reader.OBSERVED_ABSENT_COLLECTIONS,
    expectedAggregateFingerprint: EXPECTED_AGGREGATE
  }))
  const transformPlan = buildWave2TransformPlan(sanitizedSnapshot)
  const identitySpacePlan = buildWave2IdentitySpacePlan({ sanitizedSnapshot, transformPlan })
  const client = new Client({ connectionString })
  await client.connect()
  try {
    const input = { client, connectionString, markerToken, sanitizedSnapshot, transformPlan, identitySpacePlan, testcontainerCapability }
    const first = await loadWave2Export(input)
    const replay = await loadWave2Export(input)
    if (!replay.idempotentReplay || replay.targetHash !== first.targetHash) throw new Error('IDEMPOTENT_REPLAY_FAILED')
    if (verifyAvatarReplayDrift) {
      await client.query('UPDATE users SET avatar_attachment_id=NULL WHERE avatar_attachment_id IS NOT NULL')
      let driftDetected = false
      try {
        await loadWave2Export(input)
      } catch (error) {
        driftDetected = ['AVATAR_ATTACHMENT_RECIPROCAL_DRIFT', 'IDEMPOTENT_REPLAY_EVIDENCE_DRIFT'].includes(error.message)
        if (!driftDetected) throw error
      }
      if (!driftDetected) throw new Error('AVATAR_REPLAY_DRIFT_NOT_DETECTED')
      return { ...first, avatarReplayDriftDetected: true }
    }
    return first
  } finally {
    await client.end()
  }
}

const main = async () => {
  let container
  if (process.env.DATABASE_URL) throw new Error('TESTCONTAINER_ONLY: explicit DATABASE_URL is forbidden')
  if (!process.argv.includes('--testcontainer')) throw new Error('TESTCONTAINER_ONLY: --testcontainer is required')
  const { PostgreSqlContainer } = await import('@testcontainers/postgresql')
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('hey_money_v2_test').withUsername('hey_money_v2_test').withPassword('hey_money_v2_test').start()
  const connectionString = container.getConnectionUri()
  const testcontainerCapability = createTestcontainerCapability(container, connectionString)
  assertDisposableUrl(connectionString)
  try {
    const summary = await runOnDatabase(connectionString, testcontainerCapability, {
      verifyAvatarReplayDrift: process.argv.includes('--verify-avatar-replay-drift')
    })
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  } finally {
    await container?.stop()
  }
}

main().catch((error) => {
  console.error(error.code || error.message)
  process.exitCode = 1
})
