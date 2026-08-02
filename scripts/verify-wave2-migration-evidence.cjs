const { Client } = require('pg')

const connectionString = process.env.POSTGRESQL_DIRECT_URL
if (!connectionString) throw new Error('POSTGRESQL_DIRECT_URL is required for migration evidence verification')

const sensitiveKey = /(authorization|cookie|password|secret|token)/i
const sensitiveLeaks = (value, path = '$') => {
  if (Array.isArray(value)) return value.flatMap((item, index) => sensitiveLeaks(item, `${path}[${index}]`))
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, item]) => {
    const currentPath = `${path}.${key}`
    const ownLeak = sensitiveKey.test(key) && item !== null && item !== '[REDACTED]' ? [currentPath] : []
    return [...ownLeak, ...sensitiveLeaks(item, currentPath)]
  })
}

const expectRejected = async (client, sql, parameters, code, message) => {
  await client.query('BEGIN')
  let rejected = false
  try {
    await client.query(sql, parameters)
  } catch (error) {
    rejected = error.code === code && error.message.includes(message)
  }
  await client.query('ROLLBACK')
  if (!rejected) throw new Error(`Expected ${message}`)
}

const run = async () => {
  const client = new Client({ connectionString })
  await client.connect()
  try {
    const records = (await client.query(`
      SELECT id,raw_document,redaction_manifest,disposition
      FROM migration_source_records ORDER BY id
    `)).rows
    if (!records.length) throw new Error('Controlled migration source records are required')

    const hashMismatches = Number((await client.query(`
      SELECT count(*) FROM migration_source_records
      WHERE sanitized_document_hash <> encode(digest(convert_to(raw_document::text,'UTF8'),'sha256'),'hex')
    `)).rows[0].count)
    if (hashMismatches) throw new Error(`SANITIZED_DOCUMENT_HASH_MISMATCH count=${hashMismatches}`)

    const leaks = records.flatMap((record) => sensitiveLeaks(record.raw_document))
    if (leaks.length) throw new Error(`SANITIZED_DOCUMENT_SECRET_LEAK paths=${leaks.join(',')}`)
    const userRecord = records.find((record) => record.redaction_manifest.includes('$.password'))
    if (!userRecord) throw new Error('Expected password redaction manifest evidence')

    const terminal = records.find((record) => record.disposition !== 'STAGED')
    await expectRejected(
      client,
      `UPDATE migration_source_records SET raw_document=jsonb_set(raw_document,'{probe}','true'::jsonb) WHERE id=$1`,
      [terminal.id],
      '55000',
      'MIGRATION_SOURCE_EVIDENCE_IMMUTABLE'
    )
    await expectRejected(
      client,
      `DELETE FROM migration_source_records WHERE id=$1`,
      [terminal.id],
      '55000',
      'MIGRATION_SOURCE_RECORD_DELETE_FORBIDDEN'
    )
    await expectRejected(
      client,
      `UPDATE migration_source_records
       SET disposition='REJECTED',target_type=NULL,target_public_id=NULL,reject_code='ROLLBACK_PROBE',processed_at=clock_timestamp()
       WHERE id=$1`,
      [terminal.id],
      '23514',
      'MIGRATION_SOURCE_DISPOSITION_TERMINAL'
    )

    process.stdout.write(
      `Wave 2 migration evidence PASS: records=${records.length}, sanitized_hash_mismatches=0, secret_leaks=0, immutable_update/delete/terminal_transition=REJECTED.\n`
    )
  } finally {
    await client.end()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

