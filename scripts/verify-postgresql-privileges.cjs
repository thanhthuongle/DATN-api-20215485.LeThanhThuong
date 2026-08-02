require('dotenv').config()
const { Client } = require('pg')
const { resolvePostgresqlRoles } = require('./postgresql-role-policy.cjs')

const directConnectionString = process.env.POSTGRESQL_DIRECT_URL
const applicationConnectionString = process.env.POSTGRESQL_DATABASE_URL
if (!directConnectionString) throw new Error('POSTGRESQL_DIRECT_URL is required for privilege verification')
if (!applicationConnectionString) throw new Error('POSTGRESQL_DATABASE_URL is required for privilege verification')

const run = async () => {
  const roles = await resolvePostgresqlRoles({ directConnectionString, applicationConnectionString })
  const client = new Client({ connectionString: directConnectionString })
  await client.connect()
  try {
    const checks = [
      [roles.applicationRole, 'public.financial_transactions', 'SELECT', true],
      [roles.applicationRole, 'public.ledger_entries', 'INSERT', true],
      [roles.applicationRole, 'public.ledger_entries', 'UPDATE', false],
      [roles.applicationRole, 'public.posting_template_definitions', 'UPDATE', false],
      [roles.applicationRole, 'public.migration_source_records', 'SELECT', false],
      [roles.applicationRole, 'public.audit_events', 'UPDATE', false]
    ]
    for (const [role, object, privilege, expected] of checks) {
      const actual = (await client.query('SELECT has_table_privilege($1,$2,$3) AS allowed', [role, object, privilege])).rows[0].allowed
      if (actual !== expected) throw new Error(`Privilege mismatch role=${role} object=${object} privilege=${privilege} expected=${expected} actual=${actual}`)
    }
    const columnChecks = [
      [roles.applicationRole, 'public.ledger_accounts', 'status', 'UPDATE', true],
      [roles.applicationRole, 'public.ledger_accounts', 'current_balance', 'UPDATE', false],
      [roles.applicationRole, 'public.ledger_accounts', 'name', 'INSERT', true],
      [roles.applicationRole, 'public.ledger_accounts', 'current_sequence', 'INSERT', false],
      [roles.applicationRole, 'public.financial_transactions', 'status', 'UPDATE', true],
      [roles.applicationRole, 'public.financial_transactions', 'amount', 'UPDATE', false]
    ]
    for (const [role, object, column, privilege, expected] of columnChecks) {
      const actual = (await client.query('SELECT has_column_privilege($1,$2,$3,$4) AS allowed', [role, object, column, privilege])).rows[0].allowed
      if (actual !== expected) throw new Error(`Column privilege mismatch role=${role} object=${object}.${column} privilege=${privilege} expected=${expected} actual=${actual}`)
    }
    const schema = (await client.query(
      'SELECT has_schema_privilege($1,\'public\',\'USAGE\') AS usage, has_schema_privilege($1,\'public\',\'CREATE\') AS create_allowed',
      [roles.applicationRole]
    )).rows[0]
    if (!schema.usage || schema.create_allowed) throw new Error(`Unsafe schema privileges for role ${roles.applicationRole}`)
    process.stdout.write(
      `PostgreSQL privilege verification PASS: checks=${checks.length + columnChecks.length}, roles=2, direct_balance_write=DENIED, schema_create=DENIED.\n`
    )
  } finally {
    await client.end()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
