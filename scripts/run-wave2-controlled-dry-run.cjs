const { createHash } = require('node:crypto')
const { Client } = require('pg')

const sourceCollections = [
  'users', 'families', 'banks', 'categories', 'money_sources', 'accounts',
  'accumulations', 'savings_accounts', 'transactions', 'expenses', 'incomes',
  'transfers', 'contributions', 'loans', 'borrowings', 'collections',
  'repayments', 'contacts', 'budgets', 'notifications', 'user_notifications',
  'contribution_requests', 'group_payouts', 'invitations', 'proposal_expenses',
  'system_tasks'
]

const id = (suffix) => suffix.toString(16).padStart(24, '0')
const at = '2026-07-01T00:00:00.000Z'
const fixture = Object.fromEntries(sourceCollections.map((collection) => [collection, []]))

Object.assign(fixture, {
  users: [{ _id: id(1), email: 'sample@example.invalid', password: '[REDACTED]', username: 'sample', displayName: 'Controlled Sample', currency: 'VND', language: 'Tiếng Việt', createdAt: at }],
  banks: [{ _id: id(2), code: 'SAMPLE_BANK', name: 'Sanitized Sample Bank', createdAt: at }],
  categories: [
    { _id: id(3), ownerType: 'individual', ownerId: id(1), name: 'Sample income', type: 'income', createdAt: at },
    { _id: id(4), ownerType: 'individual', ownerId: id(1), name: 'Sample expense', type: 'expense', createdAt: at },
    { _id: id(5), ownerType: 'individual', ownerId: id(1), name: 'Sample transfer', type: 'transfer', createdAt: at }
  ],
  money_sources: [{ _id: id(6), ownerType: 'individual', ownerId: id(1), accountIds: [id(7), id(8)], savings_accountIds: [], accumulationIds: [id(9)] }],
  accounts: [
    { _id: id(7), ownerType: 'individual', ownerId: id(1), moneySourceId: id(6), type: 'wallet', accountName: 'Sample cash', initBalance: 1000, balance: 1050, createdAt: at },
    { _id: id(8), ownerType: 'individual', ownerId: id(1), moneySourceId: id(6), type: 'bank', accountName: 'Sample bank', bankId: id(2), initBalance: 500, balance: 550, createdAt: at }
  ],
  accumulations: [{ _id: id(9), ownerType: 'individual', ownerId: id(1), moneySourceId: id(6), accumulationName: 'Sample goal', targetBalance: 10000, balance: 0, startDate: at, endDate: '2026-12-31T00:00:00.000Z', createdAt: at }],
  transactions: [
    { _id: id(10), ownerType: 'individual', ownerId: id(1), responsiblePersonId: id(1), type: 'income', categoryId: id(3), name: 'Sample income', amount: 200, transactionTime: '2026-07-02T00:00:00.000Z', createdAt: at },
    { _id: id(11), ownerType: 'individual', ownerId: id(1), responsiblePersonId: id(1), type: 'expense', categoryId: id(4), name: 'Sample expense', amount: 100, transactionTime: '2026-07-03T00:00:00.000Z', createdAt: at },
    { _id: id(12), ownerType: 'individual', ownerId: id(1), responsiblePersonId: id(1), type: 'transfer', categoryId: id(5), name: 'Sample transfer', amount: 50, transactionTime: '2026-07-04T00:00:00.000Z', createdAt: at }
  ],
  incomes: [{ _id: id(13), transactionId: id(10), moneyTargetType: 'account', moneyTargetId: id(7), images: [] }],
  expenses: [{ _id: id(14), transactionId: id(11), moneyFromType: 'account', moneyFromId: id(7), images: [] }],
  transfers: [{ _id: id(15), transactionId: id(12), moneyFromType: 'account', moneyFromId: id(7), moneyTargetType: 'account', moneyTargetId: id(8), fee: 25, images: [] }],
  notifications: [{ _id: id(16), title: 'Sample notice', message: 'Sanitized dry-run notification', type: 'text', createdAt: at }],
  user_notifications: [{ _id: id(17), userId: id(1), notificationId: id(16), isRead: false, receiveAt: '2026-07-05T00:00:00.000Z' }],
  contribution_requests: [{ _id: id(18), archiveReason: 'SCHEMA_ONLY' }],
  group_payouts: [{ _id: id(19), archiveReason: 'SCHEMA_ONLY' }],
  invitations: [{ _id: id(20), archiveReason: 'SCHEMA_ONLY' }],
  proposal_expenses: [{ _id: id(21), archiveReason: 'SCHEMA_ONLY' }],
  system_tasks: [{ _id: id(22), name: 'legacy-unversioned-sample', archiveReason: 'AGENDA_INTERNAL_NOT_COPIED' }]
})

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable)
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'bigint') return value.toString()
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
  }
  return value
}
const hash = (value) => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
const redactedPaths = (value, path = '$') => {
  if (Array.isArray(value)) return value.flatMap((item, index) => redactedPaths(item, `${path}[${index}]`))
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => redactedPaths(item, `${path}.${key}`))
  }
  return value === '[REDACTED]' ? [path] : []
}
const uuid = (value) => {
  const bytes = createHash('sha256').update(`hey-money-v2:${value}`).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const connectionString = process.env.POSTGRESQL_DIRECT_URL
if (!connectionString) throw new Error('POSTGRESQL_DIRECT_URL is required for the controlled migration dry-run')

const snapshotId = 'wave2-sanitized-sample-v1'
const sourceManifest = sourceCollections.map((collection) => ({ collection, records: fixture[collection] }))
const sourceChecksum = hash(sourceManifest)
const sourceCount = sourceManifest.reduce((count, item) => count + item.records.length, 0)
const archiveCollections = new Set(['money_sources', 'contribution_requests', 'group_payouts', 'invitations', 'proposal_expenses', 'system_tasks'])

const run = async () => {
  const client = new Client({ connectionString })
  await client.connect()
  try {
    await client.query('BEGIN')
    const existing = await client.query(
      `SELECT id FROM migration_runs WHERE source_snapshot_id=$1 AND source_checksum=$2 AND mapping_version=$3 AND schema_version=$4 AND run_type='DRY_RUN'`,
      [snapshotId, sourceChecksum, 'w2-approved-2026-08-02', '20260802091444']
    )
    if (existing.rowCount) throw new Error('DRY_RUN_ALREADY_EXISTS: use a clean controlled database')

    const migrationRun = (await client.query(
      `INSERT INTO migration_runs (public_id,run_type,source_snapshot_id,source_checksum,mapping_version,schema_version,status,started_at,source_count)
       VALUES ($1,'DRY_RUN',$2,$3,$4,$5,'RUNNING',clock_timestamp(),$6) RETURNING id`,
      [uuid(`run:${sourceChecksum}`), snapshotId, sourceChecksum, 'w2-approved-2026-08-02', '20260802091444', sourceCount]
    )).rows[0]

    const staged = new Map()
    for (const collection of sourceCollections) {
      for (const document of fixture[collection]) {
        const result = await client.query(
          `INSERT INTO migration_source_records (
             migration_run_id,source_collection,source_legacy_id,source_hash,raw_document,
             sanitization_policy_version,redaction_manifest
           ) VALUES ($1,$2,$3,$4,$5::jsonb,'migration-redaction-v1',$6::jsonb) RETURNING id`,
          [migrationRun.id, collection, document._id, hash(document), JSON.stringify(stable(document)), JSON.stringify(redactedPaths(document))]
        )
        staged.set(`${collection}:${document._id}`, result.rows[0].id)
      }
    }

    const loaded = async (collection, legacyId, targetType, publicId) => client.query(
      `UPDATE migration_source_records SET disposition='LOADED',target_type=$1,target_public_id=$2,processed_at=clock_timestamp() WHERE id=$3`,
      [targetType, publicId, staged.get(`${collection}:${legacyId}`)]
    )
    const archived = async (collection, legacyId) => client.query(
      `UPDATE migration_source_records SET disposition='ARCHIVED',target_type='ARCHIVE_ONLY',processed_at=clock_timestamp() WHERE id=$1`,
      [staged.get(`${collection}:${legacyId}`)]
    )

    const userPublicId = uuid(`user:${id(1)}`)
    const userId = (await client.query(
      `INSERT INTO users (public_id,legacy_mongo_id,email,email_normalized,password_hash,username,username_normalized,display_name,status,created_at)
       VALUES ($1,$2,$3,$3,$4,$5,$5,$6,'ACTIVE',$7) RETURNING id`,
      [userPublicId, id(1), 'sample@example.invalid', '$2a$10$controlledSampleHashNotForAuthentication000000000000000', 'sample', 'Controlled Sample', at]
    )).rows[0].id
    await loaded('users', id(1), 'User', userPublicId)

    const spacePublicId = uuid(`personal-space:${id(1)}`)
    const spaceId = (await client.query(
      `INSERT INTO financial_spaces (public_id,kind,name,status,created_at) VALUES ($1,'PERSONAL','Controlled Sample','ACTIVE',$2) RETURNING id`,
      [spacePublicId, at]
    )).rows[0].id
    await client.query(
      `INSERT INTO financial_space_memberships (public_id,financial_space_id,user_id,role,status,joined_at,source_ref)
       VALUES ($1,$2,$3,'OWNER','ACTIVE',$4,$5::jsonb)`,
      [uuid(`membership:${id(1)}`), spaceId, userId, at, JSON.stringify({ source: 'users', legacyId: id(1) })]
    )

    const bankPublicId = uuid(`bank:${id(2)}`)
    const bankId = (await client.query(
      `INSERT INTO banks (public_id,legacy_mongo_id,code,name,created_at) VALUES ($1,$2,'SAMPLE_BANK','Sanitized Sample Bank',$3) RETURNING id`,
      [bankPublicId, id(2), at]
    )).rows[0].id
    await loaded('banks', id(2), 'Bank', bankPublicId)

    const categoryIds = new Map()
    for (const category of fixture.categories) {
      const publicId = uuid(`category:${category._id}`)
      const target = await client.query(
        `INSERT INTO categories (public_id,legacy_mongo_id,financial_space_id,name,transaction_type,created_at)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [publicId, category._id, spaceId, category.name, category.type.toUpperCase(), category.createdAt]
      )
      categoryIds.set(category._id, target.rows[0].id)
      await loaded('categories', category._id, 'Category', publicId)
    }

    const accountIds = new Map()
    for (const account of fixture.accounts) {
      const publicId = uuid(`account:${account._id}`)
      const target = await client.query(
        `INSERT INTO accounts (public_id,legacy_mongo_id,financial_space_id,bank_id,type,name,status,legacy_initial_balance,legacy_stored_balance,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE',$7,$8,$9) RETURNING id`,
        [publicId, account._id, spaceId, account.bankId ? bankId : null, account.type.toUpperCase(), account.accountName, account.initBalance, account.balance, account.createdAt]
      )
      accountIds.set(account._id, target.rows[0].id)
      await loaded('accounts', account._id, 'Account', publicId)
    }

    const accumulationPublicId = uuid(`accumulation:${id(9)}`)
    const accumulationId = (await client.query(
      `INSERT INTO accumulations (public_id,legacy_mongo_id,financial_space_id,name,target_amount,legacy_stored_balance,starts_at,ends_at,status,created_at)
       VALUES ($1,$2,$3,'Sample goal',10000,0,$4,$5,'ACTIVE',$4) RETURNING id`,
      [accumulationPublicId, id(9), spaceId, at, '2026-12-31T00:00:00.000Z']
    )).rows[0].id
    await loaded('accumulations', id(9), 'Accumulation', accumulationPublicId)

    for (const envelope of fixture.money_sources) await archived('money_sources', envelope._id)
    for (const collection of archiveCollections) {
      if (collection === 'money_sources') continue
      for (const document of fixture[collection]) await archived(collection, document._id)
    }

    const ledgerIds = new Map()
    const balances = new Map()
    const sequences = new Map()
    for (const account of fixture.accounts) {
      const target = await client.query(
        `INSERT INTO ledger_accounts (public_id,financial_space_id,kind,normal_side,account_id,name,current_balance,current_sequence,allows_negative_balance,status)
         VALUES ($1,$2,'USER_BALANCE','DEBIT',$3,$4,0,0,false,'ACTIVE') RETURNING id`,
        [uuid(`ledger-account:${account._id}`), spaceId, accountIds.get(account._id), account.accountName]
      )
      ledgerIds.set(`account:${account._id}`, target.rows[0].id)
      balances.set(String(target.rows[0].id), 0n)
      sequences.set(String(target.rows[0].id), 0n)
    }
    const accumulationLedgerId = (await client.query(
      `INSERT INTO ledger_accounts (public_id,financial_space_id,kind,normal_side,accumulation_id,name,current_balance,current_sequence,allows_negative_balance,status)
       VALUES ($1,$2,'USER_BALANCE','DEBIT',$3,'Sample goal',0,0,false,'ACTIVE') RETURNING id`,
      [uuid(`ledger-accumulation:${id(9)}`), spaceId, accumulationId]
    )).rows[0].id
    balances.set(String(accumulationLedgerId), 0n)
    sequences.set(String(accumulationLedgerId), 0n)

    const systemDefinitions = await client.query(`SELECT code,normal_side,allows_negative_balance FROM system_account_definitions ORDER BY code`)
    for (const definition of systemDefinitions.rows) {
      const target = await client.query(
        `INSERT INTO ledger_accounts (public_id,financial_space_id,kind,normal_side,system_role,name,current_balance,current_sequence,allows_negative_balance,status)
         VALUES ($1,$2,'SYSTEM',$3,$4,$4,0,0,$5,'ACTIVE') RETURNING id`,
        [uuid(`ledger-system:${spacePublicId}:${definition.code}`), spaceId, definition.normal_side, definition.code, definition.allows_negative_balance]
      )
      ledgerIds.set(`system:${definition.code}`, target.rows[0].id)
      balances.set(String(target.rows[0].id), 0n)
      sequences.set(String(target.rows[0].id), 0n)
    }

    const post = async ({ code, type, amount, occurredAt, legacyId, categoryId, name, entries, insertDetail }) => {
      const template = await client.query(`SELECT id FROM posting_template_definitions WHERE code=$1 AND status='APPROVED'`, [code])
      const publicId = uuid(`transaction:${legacyId || `${code}:${name}`}`)
      const target = await client.query(
        `INSERT INTO financial_transactions (public_id,legacy_mongo_id,financial_space_id,posting_template_definition_id,type,status,responsible_user_id,category_id,name,amount,occurred_at,business_snapshot,snapshot_schema_version,correlation_id,created_at)
         VALUES ($1,$2,$3,$4,$5,'DRAFT',$6,$7,$8,$9,$10,$11::jsonb,1,$12,$10) RETURNING id`,
        [publicId, legacyId, spaceId, template.rows[0].id, type, userId, categoryId, name, amount, occurredAt, JSON.stringify({ source: legacyId ? 'transactions' : 'opening', legacyId, ruleVersion: 'w2-approved-2026-08-02', sourceChecksum }), uuid(`correlation:${publicId}`)]
      )
      for (const entry of entries) {
        const key = String(entry.ledgerId)
        const before = balances.get(key)
        const delta = BigInt(entry.amount)
        const after = before + delta
        const sequence = sequences.get(key) + 1n
        await client.query(
          `INSERT INTO ledger_entries (public_id,financial_transaction_id,ledger_account_id,account_sequence,amount,balance_before,balance_after,posted_at,entry_role)
           VALUES ($1,$2,$3,$4,$5,$6,$7,transaction_timestamp(),$8)`,
          [uuid(`entry:${publicId}:${entry.role}`), target.rows[0].id, entry.ledgerId, sequence.toString(), delta.toString(), before.toString(), after.toString(), entry.role]
        )
        balances.set(key, after)
        sequences.set(key, sequence)
      }
      if (insertDetail) await insertDetail(target.rows[0].id)
      await client.query(`UPDATE financial_transactions SET status='POSTED' WHERE id=$1`, [target.rows[0].id])
      return { id: target.rows[0].id, publicId }
    }

    await post({ code: 'OPENING_BALANCE', type: 'ACCOUNT_OPENING', amount: 1000, occurredAt: at, name: 'Opening Sample cash', entries: [
      { ledgerId: ledgerIds.get(`account:${id(7)}`), amount: 1000, role: 'ACCOUNT' },
      { ledgerId: ledgerIds.get('system:OPENING_EQUITY'), amount: -1000, role: 'OPENING_EQUITY' }
    ] })
    await post({ code: 'OPENING_BALANCE', type: 'ACCOUNT_OPENING', amount: 500, occurredAt: at, name: 'Opening Sample bank', entries: [
      { ledgerId: ledgerIds.get(`account:${id(8)}`), amount: 500, role: 'ACCOUNT' },
      { ledgerId: ledgerIds.get('system:OPENING_EQUITY'), amount: -500, role: 'OPENING_EQUITY' }
    ] })
    const incomeDetailPublicId = uuid(`income:${id(13)}`)
    const expenseDetailPublicId = uuid(`expense:${id(14)}`)
    const transferDetailPublicId = uuid(`transfer:${id(15)}`)
    const income = await post({ code: 'INCOME', type: 'INCOME', amount: 200, occurredAt: fixture.transactions[0].transactionTime, legacyId: id(10), categoryId: categoryIds.get(id(3)), name: 'Sample income', entries: [
      { ledgerId: ledgerIds.get(`account:${id(7)}`), amount: 200, role: 'TARGET' },
      { ledgerId: ledgerIds.get('system:INCOME_CLEARING'), amount: -200, role: 'INCOME_CLEARING' }
    ], insertDetail: transactionId => client.query(
      `INSERT INTO transaction_income_details (public_id,legacy_mongo_id,financial_transaction_id,target_ledger_account_id) VALUES ($1,$2,$3,$4)`,
      [incomeDetailPublicId, id(13), transactionId, ledgerIds.get(`account:${id(7)}`)]
    ) })
    const expense = await post({ code: 'EXPENSE', type: 'EXPENSE', amount: 100, occurredAt: fixture.transactions[1].transactionTime, legacyId: id(11), categoryId: categoryIds.get(id(4)), name: 'Sample expense', entries: [
      { ledgerId: ledgerIds.get(`account:${id(7)}`), amount: -100, role: 'SOURCE' },
      { ledgerId: ledgerIds.get('system:EXPENSE_CLEARING'), amount: 100, role: 'EXPENSE_CLEARING' }
    ], insertDetail: transactionId => client.query(
      `INSERT INTO transaction_expense_details (public_id,legacy_mongo_id,financial_transaction_id,source_ledger_account_id) VALUES ($1,$2,$3,$4)`,
      [expenseDetailPublicId, id(14), transactionId, ledgerIds.get(`account:${id(7)}`)]
    ) })
    const transfer = await post({ code: 'TRANSFER', type: 'TRANSFER', amount: 50, occurredAt: fixture.transactions[2].transactionTime, legacyId: id(12), categoryId: categoryIds.get(id(5)), name: 'Sample transfer', entries: [
      { ledgerId: ledgerIds.get(`account:${id(7)}`), amount: -50, role: 'SOURCE' },
      { ledgerId: ledgerIds.get(`account:${id(8)}`), amount: 50, role: 'TARGET' }
    ], insertDetail: transactionId => client.query(
      `INSERT INTO transaction_transfer_details (public_id,legacy_mongo_id,financial_transaction_id,source_ledger_account_id,target_ledger_account_id,fee_amount) VALUES ($1,$2,$3,$4,$5,25)`,
      [transferDetailPublicId, id(15), transactionId, ledgerIds.get(`account:${id(7)}`), ledgerIds.get(`account:${id(8)}`)]
    ) })

    for (const [collection, legacyIdValue, targetType, publicId] of [
      ['transactions', id(10), 'FinancialTransaction', income.publicId], ['transactions', id(11), 'FinancialTransaction', expense.publicId], ['transactions', id(12), 'FinancialTransaction', transfer.publicId],
      ['incomes', id(13), 'TransactionIncomeDetail', incomeDetailPublicId], ['expenses', id(14), 'TransactionExpenseDetail', expenseDetailPublicId], ['transfers', id(15), 'TransactionTransferDetail', transferDetailPublicId]
    ]) await loaded(collection, legacyIdValue, targetType, publicId)

    const notificationPublicId = uuid(`notification:${id(16)}`)
    const notificationId = (await client.query(`INSERT INTO notifications (public_id,legacy_mongo_id,type,title,message,created_at) VALUES ($1,$2,'TEXT','Sample notice','Sanitized dry-run notification',$3) RETURNING id`, [notificationPublicId, id(16), at])).rows[0].id
    await loaded('notifications', id(16), 'Notification', notificationPublicId)
    const userNotificationPublicId = uuid(`user-notification:${id(17)}`)
    await client.query(`INSERT INTO user_notifications (public_id,legacy_mongo_id,user_id,notification_id,is_read,received_at) VALUES ($1,$2,$3,$4,false,$5)`, [userNotificationPublicId, id(17), userId, notificationId, fixture.user_notifications[0].receiveAt])
    await loaded('user_notifications', id(17), 'UserNotification', userNotificationPublicId)

    for (const collection of sourceCollections) {
      const records = fixture[collection]
      const loadedCount = records.filter((document) => !archiveCollections.has(collection)).length
      const archivedCount = records.length - loadedCount
      await client.query(
        `INSERT INTO migration_checkpoints (public_id,migration_run_id,graph_level,source_collection,status,processed_count,loaded_count,rejected_count,canonical_hash,started_at,completed_at)
         VALUES ($1,$2,$3,$4,'COMPLETED',$5,$6,0,$7,clock_timestamp(),clock_timestamp())`,
        [uuid(`checkpoint:${sourceChecksum}:${collection}`), migrationRun.id, sourceCollections.indexOf(collection) > 20 ? 20 : sourceCollections.indexOf(collection), collection, records.length, loadedCount, hash({ collection, records, archivedCount })]
      )
    }

    const unbalanced = Number((await client.query(`SELECT count(*) FROM (SELECT financial_transaction_id FROM ledger_entries GROUP BY financial_transaction_id HAVING sum(amount)<>0) x`)).rows[0].count)
    const projectionMismatches = Number((await client.query(`
      SELECT count(*) FROM ledger_accounts account
      LEFT JOIN LATERAL (
        SELECT coalesce(sum(entry.amount),0)::bigint balance,
               coalesce(max(entry.account_sequence),0)::bigint sequence,
               count(*)::bigint entry_count
        FROM ledger_entries entry WHERE entry.ledger_account_id=account.id
      ) projection ON true
      WHERE account.financial_space_id=$1
        AND (account.current_balance<>projection.balance OR account.current_sequence<>projection.sequence OR projection.sequence<>projection.entry_count)
    `, [spaceId])).rows[0].count)
    const actualBalanceRows = (await client.query(`
      SELECT coalesce(account.legacy_mongo_id, accumulation.legacy_mongo_id) legacy_id,
             coalesce(account.legacy_stored_balance, accumulation.legacy_stored_balance)::text stored_balance,
             ledger.current_balance::text reconstructed_balance
      FROM ledger_accounts ledger
      LEFT JOIN accounts account ON account.id=ledger.account_id
      LEFT JOIN accumulations accumulation ON accumulation.id=ledger.accumulation_id
      WHERE ledger.financial_space_id=$1 AND (account.id IS NOT NULL OR accumulation.id IS NOT NULL)
      ORDER BY legacy_id
    `, [spaceId])).rows
    const mismatches = actualBalanceRows
      .filter((row) => row.stored_balance !== row.reconstructed_balance)
      .map((row) => ({ legacyId: row.legacy_id, stored: row.stored_balance, reconstructed: row.reconstructed_balance }))
    if (unbalanced || projectionMismatches || mismatches.length) {
      throw new Error(`RECONCILIATION_FAILED unbalanced=${unbalanced} projection=${projectionMismatches} mismatches=${JSON.stringify(mismatches)}`)
    }

    const dispositionCounts = (await client.query(`SELECT disposition::text,count(*)::int count FROM migration_source_records WHERE migration_run_id=$1 GROUP BY disposition ORDER BY disposition`, [migrationRun.id])).rows
    const loadedCount = dispositionCounts.find((row) => row.disposition === 'LOADED')?.count ?? 0
    const archivedCount = dispositionCounts.find((row) => row.disposition === 'ARCHIVED')?.count ?? 0
    const queryRows = async (sql, parameters = []) => (await client.query(sql, parameters)).rows
    const targetSnapshot = {
      users: await queryRows(`SELECT public_id,legacy_mongo_id,email_normalized,username_normalized,display_name,status FROM users WHERE public_id=$1 ORDER BY public_id`, [userPublicId]),
      financialSpaces: await queryRows(`SELECT public_id,kind,name,status FROM financial_spaces WHERE id=$1 ORDER BY public_id`, [spaceId]),
      memberships: await queryRows(`SELECT membership.public_id,space.public_id financial_space_public_id,user_row.public_id user_public_id,membership.role,membership.status,membership.source_ref FROM financial_space_memberships membership JOIN financial_spaces space ON space.id=membership.financial_space_id JOIN users user_row ON user_row.id=membership.user_id WHERE membership.financial_space_id=$1 ORDER BY membership.public_id`, [spaceId]),
      banks: await queryRows(`SELECT public_id,legacy_mongo_id,code,name FROM banks WHERE public_id=$1 ORDER BY public_id`, [bankPublicId]),
      categories: await queryRows(`SELECT public_id,legacy_mongo_id,name,transaction_type FROM categories WHERE financial_space_id=$1 ORDER BY public_id`, [spaceId]),
      accounts: await queryRows(`SELECT account.public_id,account.legacy_mongo_id,bank.public_id bank_public_id,account.type,account.name,account.status,account.legacy_initial_balance::text,account.legacy_stored_balance::text FROM accounts account LEFT JOIN banks bank ON bank.id=account.bank_id WHERE account.financial_space_id=$1 ORDER BY account.public_id`, [spaceId]),
      accumulations: await queryRows(`SELECT public_id,legacy_mongo_id,name,target_amount::text,legacy_stored_balance::text,status FROM accumulations WHERE financial_space_id=$1 ORDER BY public_id`, [spaceId]),
      ledgerAccounts: await queryRows(`SELECT ledger.public_id,ledger.kind,ledger.normal_side,ledger.system_role,account.public_id account_public_id,accumulation.public_id accumulation_public_id,saving.public_id saving_public_id,ledger.name,ledger.current_balance::text,ledger.current_sequence::text,ledger.allows_negative_balance,ledger.status FROM ledger_accounts ledger LEFT JOIN accounts account ON account.id=ledger.account_id LEFT JOIN accumulations accumulation ON accumulation.id=ledger.accumulation_id LEFT JOIN savings_accounts saving ON saving.id=ledger.saving_account_id WHERE ledger.financial_space_id=$1 ORDER BY ledger.public_id`, [spaceId]),
      financialTransactions: await queryRows(`SELECT transaction.public_id,transaction.legacy_mongo_id,template.code template_code,transaction.type,transaction.status,user_row.public_id responsible_user_public_id,category.public_id category_public_id,transaction.name,transaction.description,transaction.amount::text,transaction.occurred_at,transaction.business_snapshot,transaction.snapshot_schema_version,transaction.correlation_id FROM financial_transactions transaction JOIN posting_template_definitions template ON template.id=transaction.posting_template_definition_id JOIN users user_row ON user_row.id=transaction.responsible_user_id LEFT JOIN categories category ON category.id=transaction.category_id WHERE transaction.financial_space_id=$1 ORDER BY transaction.public_id`, [spaceId]),
      ledgerEntries: await queryRows(`SELECT entry.public_id,transaction.public_id transaction_public_id,ledger.public_id ledger_account_public_id,entry.account_sequence::text,entry.amount::text,entry.balance_before::text,entry.balance_after::text,entry.entry_role FROM ledger_entries entry JOIN financial_transactions transaction ON transaction.id=entry.financial_transaction_id JOIN ledger_accounts ledger ON ledger.id=entry.ledger_account_id WHERE transaction.financial_space_id=$1 ORDER BY transaction.public_id,ledger.public_id,entry.account_sequence`, [spaceId]),
      incomeDetails: await queryRows(`SELECT detail.public_id,detail.legacy_mongo_id,transaction.public_id transaction_public_id,ledger.public_id target_ledger_public_id FROM transaction_income_details detail JOIN financial_transactions transaction ON transaction.id=detail.financial_transaction_id JOIN ledger_accounts ledger ON ledger.id=detail.target_ledger_account_id WHERE transaction.financial_space_id=$1 ORDER BY detail.public_id`, [spaceId]),
      expenseDetails: await queryRows(`SELECT detail.public_id,detail.legacy_mongo_id,transaction.public_id transaction_public_id,ledger.public_id source_ledger_public_id FROM transaction_expense_details detail JOIN financial_transactions transaction ON transaction.id=detail.financial_transaction_id JOIN ledger_accounts ledger ON ledger.id=detail.source_ledger_account_id WHERE transaction.financial_space_id=$1 ORDER BY detail.public_id`, [spaceId]),
      transferDetails: await queryRows(`SELECT detail.public_id,detail.legacy_mongo_id,transaction.public_id transaction_public_id,source.public_id source_ledger_public_id,target.public_id target_ledger_public_id,detail.fee_amount::text FROM transaction_transfer_details detail JOIN financial_transactions transaction ON transaction.id=detail.financial_transaction_id JOIN ledger_accounts source ON source.id=detail.source_ledger_account_id JOIN ledger_accounts target ON target.id=detail.target_ledger_account_id WHERE transaction.financial_space_id=$1 ORDER BY detail.public_id`, [spaceId]),
      notifications: await queryRows(`SELECT public_id,legacy_mongo_id,type,title,message,link FROM notifications WHERE public_id=$1 ORDER BY public_id`, [notificationPublicId]),
      userNotifications: await queryRows(`SELECT user_notification.public_id,user_notification.legacy_mongo_id,user_row.public_id user_public_id,notification.public_id notification_public_id,user_notification.is_read,user_notification.received_at,user_notification.read_at FROM user_notifications user_notification JOIN users user_row ON user_row.id=user_notification.user_id JOIN notifications notification ON notification.id=user_notification.notification_id WHERE user_notification.public_id=$1 ORDER BY user_notification.public_id`, [userNotificationPublicId]),
      migrationRoutes: await queryRows(`SELECT source_collection,source_legacy_id,source_hash,sanitized_document_hash,sanitization_policy_version,redaction_manifest,disposition,target_type,target_public_id,reject_code FROM migration_source_records WHERE migration_run_id=$1 ORDER BY source_collection,source_legacy_id`, [migrationRun.id]),
      checkpoints: await queryRows(`SELECT graph_level,source_collection,status,processed_count::text,loaded_count::text,rejected_count::text,canonical_hash FROM migration_checkpoints WHERE migration_run_id=$1 ORDER BY graph_level,source_collection`, [migrationRun.id])
    }
    const targetRowsHashed = Object.values(targetSnapshot).reduce((count, rows) => count + rows.length, 0)
    const targetHash = hash(targetSnapshot)
    const summary = {
      fixture: snapshotId,
      sourceChecksum,
      targetHash,
      targetTablesHashed: Object.keys(targetSnapshot).length,
      targetRowsHashed,
      collectionsRouted: sourceCollections.length,
      sourceCount,
      loadedCount,
      archivedCount,
      rejectedCount: 0,
      unclassifiedErrors: 0,
      blockingDiscrepancies: 0,
      unbalancedTransactions: unbalanced,
      ledgerProjectionMismatches: projectionMismatches,
      balanceHoldersCompared: actualBalanceRows.length,
      balanceMismatches: mismatches.length,
      toleranceVnd: 0,
      transferFeeLedgerEffectVnd: 0
    }
    await client.query(
      `UPDATE migration_runs SET status='COMPLETED',completed_at=clock_timestamp(),loaded_count=$1,rejected_count=0,summary=$2::jsonb,updated_at=clock_timestamp() WHERE id=$3`,
      [loadedCount, JSON.stringify(summary), migrationRun.id]
    )
    await client.query(
      `INSERT INTO audit_events (public_id,actor_type,action,resource_type,resource_public_id,correlation_id,evidence)
       VALUES ($1,'MIGRATION','W2_CONTROLLED_DRY_RUN_COMPLETED','migration_run',$2,$3,$4::jsonb)`,
      [uuid(`audit:${sourceChecksum}`), uuid(`run:${sourceChecksum}`), uuid(`correlation:run:${sourceChecksum}`), JSON.stringify({ sourceChecksum, targetHash })]
    )
    await client.query('COMMIT')
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
