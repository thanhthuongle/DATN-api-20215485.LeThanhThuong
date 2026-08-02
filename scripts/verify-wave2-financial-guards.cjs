const { randomUUID } = require('node:crypto')
const { Client } = require('pg')

const connectionString = process.env.POSTGRESQL_DIRECT_URL
if (!connectionString) throw new Error('POSTGRESQL_DIRECT_URL is required for financial database guard verification')

const createReversal = async (client, original, entryMagnitudeDelta = 0) => {
  const reversal = (await client.query(
    `INSERT INTO financial_transactions (
       public_id,financial_space_id,posting_template_definition_id,type,status,responsible_user_id,category_id,
       name,amount,occurred_at,reverses_transaction_id,business_snapshot,snapshot_schema_version,correlation_id
     ) VALUES ($1,$2,$3,'REVERSAL','DRAFT',$4,$5,$6,$7,transaction_timestamp(),$8,$9::jsonb,1,$10) RETURNING id`,
    [randomUUID(), original.financial_space_id, original.posting_template_definition_id, original.responsible_user_id,
      original.category_id, `Reversal probe ${original.id}`, original.amount, original.id,
      JSON.stringify({ probe: true, originalPublicId: original.public_id }), randomUUID()]
  )).rows[0]

  const entries = (await client.query(
    `SELECT e.*,a.current_balance,a.current_sequence
     FROM ledger_entries e JOIN ledger_accounts a ON a.id=e.ledger_account_id
     WHERE e.financial_transaction_id=$1 ORDER BY e.id`,
    [original.id]
  )).rows
  for (const [index, entry] of entries.entries()) {
    const delta = index === 0 ? BigInt(entryMagnitudeDelta) : BigInt(-entryMagnitudeDelta)
    const amount = -BigInt(entry.amount) + delta
    const before = BigInt(entry.current_balance)
    await client.query(
      `INSERT INTO ledger_entries (
         public_id,financial_transaction_id,ledger_account_id,account_sequence,amount,balance_before,balance_after,posted_at,entry_role
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,transaction_timestamp(),$8)`,
      [randomUUID(), reversal.id, entry.ledger_account_id, (BigInt(entry.current_sequence) + 1n).toString(),
        amount.toString(), before.toString(), (before + amount).toString(), entry.entry_role]
    )
  }
  await client.query(`UPDATE financial_transactions SET status='POSTED' WHERE id=$1`, [reversal.id])
  await client.query(`UPDATE financial_transactions SET status='REVERSED' WHERE id=$1`, [original.id])
  await client.query('SET CONSTRAINTS ALL IMMEDIATE')
}

const createIncomeProbe = async (client, original, { headerAmount = 200, includeDetail = true, type = 'INCOME' } = {}) => {
  const sourceEntries = (await client.query(
    `SELECT * FROM ledger_entries WHERE financial_transaction_id=$1 ORDER BY id`,
    [original.id]
  )).rows
  const probe = (await client.query(
    `INSERT INTO financial_transactions (
       public_id,financial_space_id,posting_template_definition_id,type,status,responsible_user_id,category_id,
       name,amount,occurred_at,business_snapshot,snapshot_schema_version,correlation_id
     ) VALUES ($1,$2,$3,$4,'DRAFT',$5,$6,$7,$8,transaction_timestamp(),$9::jsonb,1,$10) RETURNING id`,
    [randomUUID(), original.financial_space_id, original.posting_template_definition_id, type,
      original.responsible_user_id, original.category_id, 'Income semantics probe', headerAmount,
      JSON.stringify({ probe: true }), randomUUID()]
  )).rows[0]

  for (const entry of sourceEntries) {
    await client.query(
      `INSERT INTO ledger_entries (
         public_id,financial_transaction_id,ledger_account_id,account_sequence,amount,balance_before,balance_after,posted_at,entry_role
       ) VALUES ($1,$2,$3,1,$4,0,$4,transaction_timestamp(),$5)`,
      [randomUUID(), probe.id, entry.ledger_account_id, entry.amount, entry.entry_role]
    )
  }
  if (includeDetail) {
    const target = sourceEntries.find((entry) => entry.entry_role === 'TARGET')
    await client.query(
      `INSERT INTO transaction_income_details (public_id,financial_transaction_id,target_ledger_account_id)
       VALUES ($1,$2,$3)`,
      [randomUUID(), probe.id, target.ledger_account_id]
    )
  }
  await client.query(`UPDATE financial_transactions SET status='POSTED' WHERE id=$1`, [probe.id])
  await client.query('SET CONSTRAINTS ALL IMMEDIATE')
}

const expectRejected = async (client, expectedMessage, operation) => {
  await client.query('BEGIN')
  let rejected = false
  try {
    await operation()
  } catch (error) {
    rejected = error.code === '23514' && error.message.includes(expectedMessage)
  }
  await client.query('ROLLBACK')
  if (!rejected) throw new Error(`Expected database rejection ${expectedMessage}`)
}

const createMigrationOpeningProbe = async (client, originalOpening, { includeAnchor = true } = {}) => {
  const accountEntry = (await client.query(
    `SELECT * FROM ledger_entries WHERE financial_transaction_id=$1 AND entry_role='ACCOUNT'`,
    [originalOpening.id]
  )).rows[0]
  const migrationEquity = (await client.query(
    `SELECT id FROM ledger_accounts
     WHERE financial_space_id=$1 AND kind='SYSTEM' AND system_role='MIGRATION_EQUITY'`,
    [originalOpening.financial_space_id]
  )).rows[0]
  const sourceChecksum = randomUUID().replaceAll('-', '').padEnd(64, '0')
  const run = (await client.query(
    `INSERT INTO migration_runs (
       public_id,run_type,source_snapshot_id,source_checksum,mapping_version,schema_version,status,started_at,source_count
     ) VALUES ($1,'DRY_RUN',$2,$3,'w2-anchor-probe','w2-corrective','RUNNING',transaction_timestamp(),1) RETURNING id`,
    [randomUUID(), `anchor-probe-${randomUUID()}`, sourceChecksum]
  )).rows[0]
  const discrepancy = (await client.query(
    `INSERT INTO discrepancy_cases (
       public_id,fingerprint,source,type,severity,status,financial_space_id,migration_run_id,evidence,
       resolution_action,resolution_note,resolved_by_user_id,resolved_at
     ) VALUES ($1,$2,'MIGRATION','BALANCE_MISMATCH','BLOCKING','RESOLVED',$3,$4,$5::jsonb,
       'MIGRATION_EQUITY_APPROVED','Controlled rollback-only probe',$6,transaction_timestamp()) RETURNING id`,
    [randomUUID(), randomUUID().replaceAll('-', '').padEnd(64, '0'), originalOpening.financial_space_id,
      run.id, JSON.stringify({ probe: true, toleranceVnd: 0 }), originalOpening.responsible_user_id]
  )).rows[0]
  const probe = (await client.query(
    `INSERT INTO financial_transactions (
       public_id,financial_space_id,posting_template_definition_id,type,status,responsible_user_id,
       name,amount,occurred_at,business_snapshot,snapshot_schema_version,correlation_id
     ) VALUES ($1,$2,$3,'ACCOUNT_OPENING','DRAFT',$4,'Migration anchor probe',1,transaction_timestamp(),$5::jsonb,1,$6)
     RETURNING id`,
    [randomUUID(), originalOpening.financial_space_id, originalOpening.posting_template_definition_id,
      originalOpening.responsible_user_id, JSON.stringify({ probe: true, sourceChecksum }), randomUUID()]
  )).rows[0]
  for (const [ledgerAccountId, amount, role] of [
    [accountEntry.ledger_account_id, 1, 'ACCOUNT'],
    [migrationEquity.id, -1, 'MIGRATION_EQUITY']
  ]) {
    await client.query(
      `INSERT INTO ledger_entries (
         public_id,financial_transaction_id,ledger_account_id,account_sequence,amount,balance_before,balance_after,posted_at,entry_role
       ) VALUES ($1,$2,$3,1,$4,0,$4,transaction_timestamp(),$5)`,
      [randomUUID(), probe.id, ledgerAccountId, amount, role]
    )
  }
  if (includeAnchor) {
    await client.query(
      `INSERT INTO migration_anchor_details (
         public_id,financial_transaction_id,ledger_account_id,migration_run_id,discrepancy_case_id,
         source_legacy_balance,reconstructed_balance,difference_amount,source_checksum,
         approval_actor_user_id,approval_reason,approved_at
       ) VALUES ($1,$2,$3,$4,$5,101,100,1,$6,$7,'Controlled rollback-only approval',transaction_timestamp())`,
      [randomUUID(), probe.id, accountEntry.ledger_account_id, run.id, discrepancy.id, sourceChecksum,
        originalOpening.responsible_user_id]
    )
  }
  await client.query(`UPDATE financial_transactions SET status='POSTED' WHERE id=$1`, [probe.id])
  await client.query('SET CONSTRAINTS ALL IMMEDIATE')
}

const run = async () => {
  const client = new Client({ connectionString })
  await client.connect()
  try {
    const projectionMismatches = Number((await client.query(`
      SELECT count(*)
      FROM ledger_accounts account
      LEFT JOIN LATERAL (
        SELECT coalesce(sum(entry.amount), 0)::bigint AS balance,
               coalesce(max(entry.account_sequence), 0)::bigint AS sequence,
               count(*)::bigint AS entry_count
        FROM ledger_entries entry
        WHERE entry.ledger_account_id = account.id
      ) projection ON true
      WHERE account.current_balance <> projection.balance
         OR account.current_sequence <> projection.sequence
         OR projection.sequence <> projection.entry_count
    `)).rows[0].count)
    if (projectionMismatches) throw new Error(`LEDGER_PROJECTION_MISMATCH count=${projectionMismatches}`)

    const original = (await client.query(
      `SELECT * FROM financial_transactions WHERE type='INCOME' AND status='POSTED' ORDER BY id LIMIT 1`
    )).rows[0]
    if (!original) throw new Error('Controlled dry-run INCOME transaction is required')

    await client.query('BEGIN')
    await createReversal(client, original)
    await client.query('ROLLBACK')

    let invalidRejected = false
    await client.query('BEGIN')
    try {
      await createReversal(client, original, 1)
    } catch (error) {
      invalidRejected = error.code === '23514' && error.message.includes('REVERSAL_ENTRIES_NOT_EXACT_OPPOSITE')
    }
    await client.query('ROLLBACK')
    if (!invalidRejected) throw new Error('Invalid non-opposite reversal was not rejected')

    await client.query('BEGIN')
    await createIncomeProbe(client, original)
    await client.query('ROLLBACK')
    await expectRejected(client, 'INCOME_POSTING_SEMANTICS_MISMATCH', () =>
      createIncomeProbe(client, original, { headerAmount: 201 })
    )
    await expectRejected(client, 'INCOME_POSTING_SEMANTICS_MISMATCH', () =>
      createIncomeProbe(client, original, { includeDetail: false })
    )
    await expectRejected(client, 'TRANSACTION_TEMPLATE_TYPE_MISMATCH', () =>
      createIncomeProbe(client, original, { type: 'EXPENSE' })
    )

    const originalOpening = (await client.query(
      `SELECT transaction.* FROM financial_transactions transaction
       JOIN posting_template_definitions template ON template.id=transaction.posting_template_definition_id
       WHERE template.code='OPENING_BALANCE' AND transaction.status='POSTED' ORDER BY transaction.id LIMIT 1`
    )).rows[0]
    await client.query('BEGIN')
    await createMigrationOpeningProbe(client, originalOpening)
    await client.query('ROLLBACK')
    await expectRejected(client, 'OPENING_EQUITY_ROLE_XOR_REQUIRED', () =>
      createMigrationOpeningProbe(client, originalOpening, { includeAnchor: false })
    )

    process.stdout.write('Wave 2 financial guards PASS: ledger projection, exact reversal, posting semantics and audited migration anchor; all probe writes rolled back.\n')
  } finally {
    await client.end()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
