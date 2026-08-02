const { randomUUID } = require('node:crypto')
const { Client } = require('pg')

const connectionString = process.env.POSTGRESQL_DATABASE_URL
if (!connectionString) throw new Error('POSTGRESQL_DATABASE_URL is required')

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

const run = async () => {
  const client = new Client({ connectionString })
  await client.connect()
  try {
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

    process.stdout.write('Wave 2 financial guards PASS: exact reversal accepted; non-opposite reversal rejected; all probe writes rolled back.\n')
  } finally {
    await client.end()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
