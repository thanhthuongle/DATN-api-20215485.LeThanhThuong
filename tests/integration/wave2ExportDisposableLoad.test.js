import { describe, expect, it } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { assertDisposableUrl } = require('../../scripts/lib/wave2-export-postgresql-loader.cjs')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const runner = path.join(root, 'scripts', 'run-wave2-export-disposable-load.cjs')

const runCleanLoad = (extraArguments = []) => {
  const env = { ...process.env }
  delete env.DATABASE_URL
  return JSON.parse(execFileSync(process.execPath, [runner, '--testcontainer', ...extraArguments], {
    cwd: root,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000
  }))
}

describe('Wave 2 export disposable PostgreSQL load', () => {
  it('rejects an explicitly supplied DATABASE_URL without starting a load', () => {
    const result = spawnSync(process.execPath, [runner, '--testcontainer'], {
      cwd: root,
      env: { ...process.env, DATABASE_URL: 'postgresql://user:pass@localhost:5432/hey_money_v2_test' },
      encoding: 'utf8',
      timeout: 10_000
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/TESTCONTAINER_ONLY/)
  })

  it('rejects provider and non-test database URLs before migration', () => {
    expect(() => assertDisposableUrl('postgresql://user:pass@db.example.supabase.co:5432/postgres')).toThrow(/NON_DISPOSABLE/)
    expect(() => assertDisposableUrl('postgresql://user:pass@localhost:5432/production')).toThrow(/NON_DISPOSABLE_DATABASE_NAME/)
    expect(assertDisposableUrl('postgresql://user:pass@127.0.0.1:5432/hey_money_v2_test'))
      .toContain('hey_money_v2_test')
  })

  it('loads two independent clean databases with identical semantic target hashes', { timeout: 120_000 }, () => {
    const first = runCleanLoad()
    const second = runCleanLoad(['--verify-avatar-replay-drift'])

    expect(first).toMatchObject({
      sourceCount: 763, loadedCount: 756, archivedCount: 7, rejectedCount: 0, checkpointCount: 26,
      userCount: 3, personalSpaceCount: 3, bankCount: 21, categoryCount: 207, accountCount: 4,
      accumulationCount: 2, contactCount: 2, ledgerCount: 30, postingCount: 128,
      postingEntryCount: 256, transactionCount: 124, budgetCount: 1, notificationCount: 134,
      notificationRecipientCount: 134, legacyAssetCount: 3, requiresReviewAttachmentCount: 3,
      unbalancedTransactions: 0, ledgerProjectionMismatches: 0,
      balanceHoldersCompared: 6, balanceMismatches: 0, toleranceVnd: 0
    })
    expect(first.targetHash).toMatch(/^[a-f0-9]{64}$/)
    expect(second.targetHash).toBe(first.targetHash)
    expect(second.avatarReplayDriftDetected).toBe(true)
    expect(JSON.stringify(first)).not.toMatch(/password|private|@|postgresql:\/\//i)
  })
})
