import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { assertDisposableUrl, CHECKPOINT_GRAPH_LEVEL } = require('../../scripts/lib/wave2-export-postgresql-loader.cjs')

describe('Wave 2 disposable PostgreSQL URL gate', () => {
  it.each([
    'postgresql://user:pass@localhost:5432/hey_money_v2_test?host=evil.example.com',
    'postgresql://user:pass@localhost:5432/hey_money_v2_test?hostaddr=203.0.113.1',
    'postgresql://user:pass@localhost:5432/hey_money_v2_test?service=production',
    'postgresql://user:pass@localhost:5432/hey_money_v2_test?sslmode=require',
    'postgresql://user:pass@localhost:5432/hey_money_v2_test?port=6543',
    'postgresql://user:pass@localhost:5432/hey_money_v2_test?options=--search_path%3Dprivate',
    'postgresql://user:pass@localhost:5432/hey_money_v2_test?application_name=unreviewed',
    'postgresql://user:pass@localhost:5432/contest_production',
    'postgresql://user:pass@db.example.supabase.co:5432/hey_money_v2_test'
  ])('rejects disallowed target %s', (connectionString) => {
    expect(() => assertDisposableUrl(connectionString)).toThrow(/NON_DISPOSABLE_DATABASE/)
  })

  it.each([
    'postgresql://user:pass@127.0.0.1:5432/hey_money_v2_test',
    'postgresql://user:pass@localhost:5432/wave2?schema=public',
    'postgresql://user:pass@host.docker.internal:5432/export_disposable'
  ])('allows explicit disposable target %s', (connectionString) => {
    expect(assertDisposableUrl(connectionString)).toBe(connectionString)
  })

  it('uses the reviewed L0-L20 source dependency levels', () => {
    expect(Object.keys(CHECKPOINT_GRAPH_LEVEL)).toHaveLength(26)
    expect(CHECKPOINT_GRAPH_LEVEL).toMatchObject({
      users: 2, families: 4, banks: 5, categories: 5, money_sources: 7,
      accounts: 8, accumulations: 8, transactions: 11, expenses: 12,
      incomes: 12, loans: 13, contacts: 5, budgets: 10, notifications: 15,
      user_notifications: 15, contribution_requests: 17, system_tasks: 17
    })
  })
})
