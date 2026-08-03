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
  'accounts', 'accumulations', 'attachments', 'audit_events',
  'budget_allocations', 'budgets', 'categories', 'category_edges', 'contacts', 'debt_agreements', 'debt_settlements',
  'discrepancy_cases', 'feature_flag_overrides', 'financial_spaces', 'financial_space_memberships',
  'financial_transactions', 'idempotency_records', 'interspace_transfer_groups', 'ledger_entries',
  'notifications', 'outbox_events', 'saving_periods', 'savings_accounts', 'sessions', 'temporary_assets',
  'token_families', 'transaction_expense_details', 'transaction_income_details', 'transaction_saving_details',
  'transaction_transfer_details', 'user_notifications', 'users'
]

const applicationUpdateColumns = {
  accounts: ['bank_id', 'name', 'description', 'icon', 'status', 'closed_at', 'updated_at', 'deleted_at'],
  accumulations: ['name', 'description', 'target_amount', 'status', 'finished_at', 'updated_at', 'deleted_at'],
  attachments: ['status', 'finalize_outbox_event_id', 'activated_at', 'removed_at', 'updated_at'],
  budget_allocations: ['amount', 'repeat_enabled', 'updated_at'],
  budgets: ['status', 'updated_at', 'deleted_at'],
  categories: ['name', 'icon', 'updated_at', 'deleted_at'],
  contacts: ['name', 'trust_level', 'updated_at', 'deleted_at'],
  discrepancy_cases: ['status', 'assigned_to_user_id', 'resolution_action', 'resolution_note', 'resolved_by_user_id', 'resolved_at', 'updated_at'],
  feature_flag_overrides: ['enabled', 'reason', 'updated_at'],
  notifications: ['updated_at', 'deleted_at'],
  savings_accounts: ['name', 'description', 'status', 'closed_at', 'updated_at', 'deleted_at'],
  sessions: ['status', 'last_used_at', 'replaced_by_session_id', 'revoked_at', 'revoked_reason', 'updated_at'],
  temporary_assets: ['status', 'expires_at', 'activated_at', 'deleted_at', 'updated_at'],
  token_families: ['status', 'revoked_reason', 'revoked_at', 'updated_at'],
  user_notifications: ['is_read', 'read_at', 'updated_at', 'deleted_at'],
  users: ['email', 'email_normalized', 'password_hash', 'username', 'username_normalized', 'display_name', 'status',
    'avatar_attachment_id', 'language_code', 'currency_code', 'timezone', 'reminder_enabled', 'reminder_local_time',
    'week_start', 'month_start_day', 'auth_version', 'updated_at', 'deleted_at']
}

const applicationUpdateTables = Object.keys(applicationUpdateColumns)
const applicationDeleteTables = ['sessions']

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

const grantInsertColumns = async (client, tables, role) => {
  const excludedForEveryTable = new Set(['id', 'public_id', 'legacy_mongo_id', 'created_at', 'updated_at', 'deleted_at'])
  const excludedByTable = {
    debt_agreements: new Set(['status', 'outstanding_principal', 'outstanding_interest', 'settled_at']),
    financial_transactions: new Set(['posted_at']),
    ledger_accounts: new Set(['current_balance', 'current_sequence']),
    ledger_entries: new Set(['account_sequence', 'balance_before', 'balance_after', 'posted_at'])
  }
  const result = await client.query(
    `SELECT table_name,column_name
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name=ANY($1::text[])
      ORDER BY table_name,ordinal_position`,
    [tables]
  )
  const columnsByTable = new Map(tables.map((table) => [table, []]))
  for (const { table_name: table, column_name: column } of result.rows) {
    if (!excludedForEveryTable.has(column) && !excludedByTable[table]?.has(column)) columnsByTable.get(table).push(column)
  }
  for (const [table, columns] of columnsByTable) await grantColumns(client, 'INSERT', table, columns, role)
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
    await grantInsertColumns(client, applicationInsertTables, applicationRole)
    for (const [table, columns] of Object.entries(applicationUpdateColumns)) {
      await grantColumns(client, 'UPDATE', table, columns, applicationRole)
    }
    await grant(client, 'DELETE', applicationDeleteTables, applicationRole)
    await grantColumns(client, 'INSERT', 'ledger_accounts', [
      'financial_space_id', 'kind', 'normal_side', 'system_role', 'account_id',
      'accumulation_id', 'saving_account_id', 'name', 'allows_negative_balance', 'status', 'closed_at'
    ], applicationRole)
    await grantColumns(client, 'UPDATE', 'ledger_accounts', ['status', 'closed_at', 'updated_at'], applicationRole)
    await grantColumns(client, 'UPDATE', 'financial_transactions', ['status', 'updated_at'], applicationRole)
    await grantColumns(client, 'UPDATE', 'financial_spaces', ['name', 'status', 'background_attachment_id', 'updated_at', 'deleted_at'], applicationRole)
    await grantColumns(client, 'UPDATE', 'financial_space_memberships', ['role', 'status', 'ended_at', 'updated_at'], applicationRole)
    await grantColumns(client, 'UPDATE', 'idempotency_records', [
      'status', 'resource_type', 'resource_public_id', 'response_status', 'response_body', 'error_code',
      'lease_owner', 'lease_expires_at', 'completed_at', 'response_purge_after', 'updated_at'
    ], applicationRole)
    await grantColumns(client, 'UPDATE', 'outbox_events', [
      'status', 'attempt_count', 'next_attempt_at', 'lease_owner', 'lease_expires_at', 'last_error_code',
      'last_error_summary', 'delivered_at', 'updated_at'
    ], applicationRole)
    await grantColumns(client, 'UPDATE', 'interspace_transfer_groups', ['status', 'updated_at'], applicationRole)
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
  applicationUpdateColumns,
  discoverPostgresqlRole,
  provisionPostgresqlRoles,
  resolvePostgresqlRoles
}
