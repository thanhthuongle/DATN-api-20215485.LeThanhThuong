const { Client } = require('pg')

const expectedTables = [
  'account_balance_snapshots',
  'accounts',
  'accumulations',
  'attachments',
  'audit_events',
  'balance_snapshot_runs',
  'banks',
  'budget_allocations',
  'budgets',
  'categories',
  'category_edges',
  'contacts',
  'debt_agreements',
  'debt_settlements',
  'discrepancy_cases',
  'feature_flag_overrides',
  'financial_spaces',
  'financial_space_memberships',
  'financial_transactions',
  'idempotency_records',
  'inbox_receipts',
  'interspace_transfer_groups',
  'ledger_accounts',
  'ledger_entries',
  'migration_anchor_details',
  'migration_checkpoints',
  'migration_runs',
  'migration_source_records',
  'notifications',
  'outbox_delivery_attempts',
  'outbox_events',
  'posting_template_definitions',
  'posting_template_entry_roles',
  'saving_periods',
  'savings_accounts',
  'sessions',
  'system_account_definitions',
  'temporary_assets',
  'token_families',
  'transaction_expense_details',
  'transaction_income_details',
  'transaction_saving_details',
  'transaction_transfer_details',
  'user_notifications',
  'users'
]
const expectedViews = [
  'v2_readonly_discrepancy_summary',
  'v2_readonly_financial_transactions',
  'v2_readonly_ledger_accounts',
  'v2_readonly_migration_runs'
]

const connectionString = process.env.POSTGRESQL_DIRECT_URL

if (!connectionString) {
  throw new Error('POSTGRESQL_DIRECT_URL is required for schema verification')
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const scalar = async (client, sql) => Number((await client.query(sql)).rows[0].count)

const run = async () => {
  const client = new Client({ connectionString })
  await client.connect()

  try {
    const tableResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name <> '_prisma_migrations'
      ORDER BY table_name
    `)
    const actualTables = tableResult.rows.map(({ table_name: tableName }) => tableName)
    assert(
      JSON.stringify(actualTables) === JSON.stringify([...expectedTables].sort()),
      `Expected exactly ${expectedTables.length} Wave 2 tables, received ${actualTables.length}`
    )
    const viewResult = await client.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)
    const actualViews = viewResult.rows.map(({ table_name: tableName }) => tableName)
    assert(JSON.stringify(actualViews) === JSON.stringify(expectedViews), `Expected exactly ${expectedViews.length} safe views, received ${actualViews.length}`)

    const enumCount = await scalar(
      client,
      `SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e'`
    )
    const foreignKeyCount = await scalar(
      client,
      `SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.contype = 'f'`
    )
    const checkCount = await scalar(
      client,
      `SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.contype = 'c'`
    )
    const triggerCount = await scalar(
      client,
      `SELECT count(*) FROM information_schema.triggers WHERE trigger_schema = 'public'`
    )
    const publicGrantCount = await scalar(
      client,
      `SELECT count(*) FROM information_schema.table_privileges WHERE table_schema = 'public' AND grantee = 'PUBLIC'`
    )

    assert(enumCount === 52, `Expected 52 enums, received ${enumCount}`)
    assert(foreignKeyCount === 105, `Expected 105 foreign keys, received ${foreignKeyCount}`)
    assert(checkCount >= 70, `Expected at least 70 checks, received ${checkCount}`)
    assert(triggerCount >= 50, `Expected at least 50 triggers, received ${triggerCount}`)
    assert(publicGrantCount === 0, `Expected no PUBLIC table grants, received ${publicGrantCount}`)

    await client.query('BEGIN')
    const audit = await client.query(`
      INSERT INTO audit_events (
        actor_type, action, resource_type, correlation_id
      ) VALUES (
        'SYSTEM', 'W2_SCHEMA_IMMUTABILITY_PROBE', 'schema', gen_random_uuid()
      ) RETURNING id
    `)
    let immutabilityGuarded = false
    try {
      await client.query('UPDATE audit_events SET action = action WHERE id = $1', [audit.rows[0].id])
    } catch (error) {
      immutabilityGuarded = error.code === '55000' && error.message.includes('APPEND_ONLY_ROW_IMMUTABLE')
    }
    await client.query('ROLLBACK')
    assert(immutabilityGuarded, 'Append-only audit trigger did not reject update')

    process.stdout.write(
      `Wave 2 schema verification PASS: tables=${actualTables.length}, safe_views=${actualViews.length}, enums=${enumCount}, foreign_keys=${foreignKeyCount}, checks=${checkCount}, triggers=${triggerCount}, public_grants=${publicGrantCount}, append_only=PASS\n`
    )
  } finally {
    await client.end()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
