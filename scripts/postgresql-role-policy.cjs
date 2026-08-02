const { Client } = require('pg')

const applicationSelectTables = [
  'account_balance_snapshots', 'accounts', 'accumulations', 'attachments', 'balance_snapshot_runs', 'banks',
  'budget_allocations', 'budgets', 'categories', 'category_edges', 'contacts', 'debt_agreements', 'debt_settlements',
  'discrepancy_cases', 'feature_flag_overrides', 'financial_spaces', 'financial_space_memberships',
  'financial_transactions', 'idempotency_records', 'interspace_transfer_groups', 'ledger_accounts', 'ledger_entries',
  'notifications', 'outbox_events', 'posting_template_definitions', 'posting_template_entry_roles', 'saving_periods',
  'savings_accounts', 'sessions', 'system_account_definitions', 'temporary_assets', 'token_families',
  'transaction_expense_details', 'transaction_income_details', 'transaction_saving_details',
  'transaction_transfer_details', 'user_notifications', 'users'
]

const applicationInsertTables = [
  'account_balance_snapshots', 'accounts', 'accumulations', 'attachments', 'audit_events', 'balance_snapshot_runs',
  'budget_allocations', 'budgets', 'categories', 'category_edges', 'contacts', 'debt_agreements', 'debt_settlements',
  'discrepancy_cases', 'feature_flag_overrides', 'financial_spaces', 'financial_space_memberships',
  'financial_transactions', 'idempotency_records', 'interspace_transfer_groups', 'ledger_entries',
  'notifications', 'outbox_events', 'saving_periods', 'savings_accounts', 'sessions', 'temporary_assets',
  'token_families', 'transaction_expense_details', 'transaction_income_details', 'transaction_saving_details',
  'transaction_transfer_details', 'user_notifications', 'users'
]

const applicationUpdateTables = [
  'accounts', 'accumulations', 'attachments', 'balance_snapshot_runs', 'budget_allocations', 'budgets', 'categories',
  'category_edges', 'contacts', 'debt_agreements', 'discrepancy_cases', 'feature_flag_overrides', 'financial_spaces',
  'financial_space_memberships', 'idempotency_records', 'interspace_transfer_groups',
  'notifications', 'outbox_events', 'saving_periods', 'savings_accounts', 'sessions',
  'temporary_assets', 'token_families', 'user_notifications', 'users'
]

const applicationDeleteTables = ['sessions', 'temporary_assets']

const quoteIdentifier = (value) => {
  if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(value)) throw new Error(`Unsafe PostgreSQL role identifier: ${value}`)
  return `"${value.replaceAll('"', '""')}"`
}
const quoteObjects = (values) => values.map((value) => `"public"."${value}"`).join(', ')

const grant = async (client, privilege, objects, role) => {
  if (!objects.length) return
  await client.query(`GRANT ${privilege} ON TABLE ${quoteObjects(objects)} TO ${quoteIdentifier(role)}`)
}

const grantColumns = async (client, privilege, table, columns, role) => {
  const quotedColumns = columns.map((column) => `"${column}"`).join(', ')
  await client.query(
    `GRANT ${privilege} (${quotedColumns}) ON TABLE "public"."${table}" TO ${quoteIdentifier(role)}`
  )
}

const grantSequencesForTables = async (client, tables, role) => {
  const result = await client.query(
    `SELECT pg_get_serial_sequence(format('%I.%I', 'public', table_name), 'id') AS sequence_name
     FROM unnest($1::text[]) table_name`,
    [tables]
  )
  const sequences = result.rows.map(({ sequence_name: sequenceName }) => sequenceName).filter(Boolean)
  if (sequences.length) {
    const quoted = sequences.map((sequence) => sequence.split('.').map(quoteIdentifier).join('.')).join(', ')
    await client.query(`GRANT USAGE, SELECT ON SEQUENCE ${quoted} TO ${quoteIdentifier(role)}`)
  }
}

const discoverPostgresqlRole = async (connectionString, label) => {
  if (!connectionString) throw new Error(`${label} PostgreSQL connection string is required`)
  const client = new Client({ connectionString })
  await client.connect()
  try {
    const role = (await client.query('SELECT current_user::text AS role')).rows[0].role
    quoteIdentifier(role)
    return role
  } finally {
    await client.end()
  }
}

const resolvePostgresqlRoles = async ({ directConnectionString, applicationConnectionString }) => {
  const [migrationRole, applicationRole] = await Promise.all([
    discoverPostgresqlRole(directConnectionString, 'Direct/migration'),
    discoverPostgresqlRole(applicationConnectionString, 'Runtime/application')
  ])
  if (migrationRole === applicationRole) {
    throw new Error('POSTGRESQL_DIRECT_URL and POSTGRESQL_DATABASE_URL must authenticate as distinct PostgreSQL roles')
  }
  return { migrationRole, applicationRole }
}

const provisionPostgresqlRoles = async ({ directConnectionString, applicationConnectionString }) => {
  const { migrationRole, applicationRole } = await resolvePostgresqlRoles({
    directConnectionString,
    applicationConnectionString
  })
  const client = new Client({ connectionString: directConnectionString })
  await client.connect()
  try {
    await client.query('BEGIN')
    const quotedApplicationRole = quoteIdentifier(applicationRole)
    await client.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${quotedApplicationRole}`)
    await client.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${quotedApplicationRole}`)
    await client.query(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM ${quotedApplicationRole}`)
    await client.query(`REVOKE CREATE ON SCHEMA public FROM ${quotedApplicationRole}`)
    await client.query(`GRANT USAGE ON SCHEMA public TO ${quotedApplicationRole}`)
    await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdentifier(migrationRole)} IN SCHEMA public REVOKE ALL ON TABLES FROM ${quotedApplicationRole}`)
    await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdentifier(migrationRole)} IN SCHEMA public REVOKE ALL ON SEQUENCES FROM ${quotedApplicationRole}`)
    await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdentifier(migrationRole)} IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM ${quotedApplicationRole}`)

    await grant(client, 'SELECT', applicationSelectTables, applicationRole)
    await grant(client, 'INSERT', applicationInsertTables, applicationRole)
    await grant(client, 'UPDATE', applicationUpdateTables, applicationRole)
    await grant(client, 'DELETE', applicationDeleteTables, applicationRole)
    await grantColumns(client, 'INSERT', 'ledger_accounts', [
      'public_id', 'financial_space_id', 'kind', 'normal_side', 'system_role', 'account_id',
      'accumulation_id', 'saving_account_id', 'name', 'allows_negative_balance', 'status', 'closed_at', 'created_at',
      'updated_at'
    ], applicationRole)
    await grantColumns(client, 'UPDATE', 'ledger_accounts', ['status', 'closed_at', 'updated_at'], applicationRole)
    await grantColumns(client, 'UPDATE', 'financial_transactions', ['status', 'updated_at'], applicationRole)
    await grantSequencesForTables(client, [...applicationInsertTables, 'ledger_accounts'], applicationRole)

    await client.query('COMMIT')
    return { migrationRole, applicationRole }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    await client.end()
  }
}

module.exports = {
  applicationDeleteTables,
  applicationInsertTables,
  applicationSelectTables,
  applicationUpdateTables,
  discoverPostgresqlRole,
  provisionPostgresqlRoles,
  resolvePostgresqlRoles
}
