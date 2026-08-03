const { randomUUID } = require('node:crypto')
const { Client } = require('pg')

const connectionString = process.env.POSTGRESQL_DIRECT_URL
if (!connectionString) throw new Error('POSTGRESQL_DIRECT_URL is required for financial database guard verification')
const disposableMarkerToken = process.env.WAVE2_DISPOSABLE_DATABASE_TOKEN
if (!disposableMarkerToken || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(disposableMarkerToken)) {
  throw new Error('WAVE2_DISPOSABLE_DATABASE_TOKEN must be an explicit random UUID for a verifier-owned disposable database')
}

const assertDisposableMarker = async (client) => {
  const markerTable = (await client.query(`SELECT to_regclass('public.wave2_disposable_database_markers')::text AS name`)).rows[0]?.name
  if (!markerTable) throw new Error('Financial guard verification refused: disposable database marker table is absent')
  const marker = (await client.query(
    `SELECT 1 FROM wave2_disposable_database_markers
      WHERE token=$1::uuid AND database_name=current_database() AND database_owner=current_user
        AND purpose='WAVE2_FINANCIAL_GUARDS' AND expires_at>clock_timestamp()`,
    [disposableMarkerToken]
  )).rows[0]
  if (!marker) throw new Error('Financial guard verification refused: disposable database marker is missing, expired, or owned by another database role')
}

const createReversal = async (client, original, entryMagnitudeDelta = 0) => {
  const reversal = (await client.query(
    `INSERT INTO financial_transactions (
       public_id,financial_space_id,posting_template_definition_id,type,status,responsible_user_id,category_id,
       name,amount,occurred_at,reverses_transaction_id,business_snapshot,snapshot_schema_version,correlation_id
     ) VALUES ($1,$2,$3,'REVERSAL','DRAFT',$4,$5,$6,$7,transaction_timestamp(),$8,$9::jsonb,1,$10) RETURNING id`,
    [randomUUID(), original.financial_space_id, original.posting_template_definition_id, original.responsible_user_id,
      original.category_id, `Reversal probe ${original.id}`, BigInt(original.amount) < 0n ? (-BigInt(original.amount)).toString() : original.amount, original.id,
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
  if (client.wave2ProbeTransaction) return expectRejectedAtSavepoint(client, expectedMessage, operation)
  await client.query('BEGIN')
  let rejected = false
  let observedError
  try {
    await operation()
  } catch (error) {
    observedError = error
    rejected = ['23514', '55000', '42501'].includes(error.code) && error.message.includes(expectedMessage)
  }
  await client.query('ROLLBACK')
  if (!rejected) {
    const observed = observedError ? `; observed ${observedError.code || 'unknown'}: ${observedError.message}` : '; operation succeeded'
    throw new Error(`Expected database rejection ${expectedMessage}${observed}`)
  }
}

let rejectionSavepointSequence = 0
const expectRejectedAtSavepoint = async (client, expectedMessage, operation) => {
  rejectionSavepointSequence += 1
  const savepoint = `expected_rejection_${rejectionSavepointSequence}`
  await client.query(`SAVEPOINT ${savepoint}`)
  let rejected = false
  let observedError
  try {
    await operation()
  } catch (error) {
    observedError = error
    rejected = ['23514', '55000', '42501'].includes(error.code) && error.message.includes(expectedMessage)
  }
  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
  await client.query(`RELEASE SAVEPOINT ${savepoint}`)
  if (!rejected) {
    const observed = observedError ? `; observed ${observedError.code || 'unknown'}: ${observedError.message}` : '; operation succeeded'
    throw new Error(`Expected database rejection ${expectedMessage}${observed}`)
  }
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

const verifyNegativeOpeningPolicy = async (client, originalOpening) => {
  await client.query('BEGIN')
  try {
    const account = (await client.query(
      `INSERT INTO accounts (financial_space_id,type,name,legacy_initial_balance,legacy_stored_balance)
       VALUES ($1,'OTHER','Negative opening probe',-100,-100) RETURNING id`,
      [originalOpening.financial_space_id]
    )).rows[0]
    const ledger = (await client.query(
      `INSERT INTO ledger_accounts (financial_space_id,kind,normal_side,account_id,name,allows_negative_balance,status)
       VALUES ($1,'USER_BALANCE','DEBIT',$2,'Negative opening probe',false,'ACTIVE') RETURNING id`,
      [originalOpening.financial_space_id, account.id]
    )).rows[0]
    const equity = (await client.query(
      `SELECT id FROM ledger_accounts WHERE financial_space_id=$1 AND system_role='OPENING_EQUITY'`,
      [originalOpening.financial_space_id]
    )).rows[0]
    const opening = (await client.query(
      `INSERT INTO financial_transactions (
         financial_space_id,posting_template_definition_id,type,status,responsible_user_id,name,amount,
         occurred_at,business_snapshot,snapshot_schema_version,correlation_id
       ) VALUES ($1,$2,'ACCOUNT_OPENING','DRAFT',$3,'Negative opening probe',-100,clock_timestamp(),'{}',1,$4) RETURNING *`,
      [originalOpening.financial_space_id, originalOpening.posting_template_definition_id,
        originalOpening.responsible_user_id, randomUUID()]
    )).rows[0]
    await client.query(
      `INSERT INTO ledger_entries (financial_transaction_id,ledger_account_id,account_sequence,amount,balance_before,balance_after,posted_at,entry_role)
       VALUES ($1,$2,1,-100,0,-100,clock_timestamp(),'ACCOUNT'),($1,$3,1,100,0,100,clock_timestamp(),'OPENING_EQUITY')`,
      [opening.id, ledger.id, equity.id]
    )
    await client.query(`UPDATE financial_transactions SET status='POSTED' WHERE id=$1`, [opening.id])
    await client.query('SET CONSTRAINTS ALL IMMEDIATE')
    await client.query('SET CONSTRAINTS ALL DEFERRED')

    const expenseTemplate = (await client.query(`SELECT id FROM posting_template_definitions WHERE code='EXPENSE' AND status='APPROVED'`)).rows[0]
    const outgoing = (await client.query(
      `INSERT INTO financial_transactions (financial_space_id,posting_template_definition_id,type,status,responsible_user_id,name,amount,occurred_at,business_snapshot,snapshot_schema_version,correlation_id)
       VALUES ($1,$2,'EXPENSE','DRAFT',$3,'Negative outgoing probe',1,clock_timestamp(),'{}',1,$4) RETURNING id`,
      [originalOpening.financial_space_id, expenseTemplate.id, originalOpening.responsible_user_id, randomUUID()]
    )).rows[0]
    await client.query('SAVEPOINT negative_outgoing')
    let outgoingRejected = false
    try {
      await client.query(
        `INSERT INTO ledger_entries (financial_transaction_id,ledger_account_id,account_sequence,amount,balance_before,balance_after,posted_at,entry_role)
         VALUES ($1,$2,1,-1,0,-1,clock_timestamp(),'SOURCE')`, [outgoing.id, ledger.id]
      )
    } catch (error) {
      outgoingRejected = error.code === '23514' && error.message.includes('LEDGER_NEGATIVE_BALANCE_FORBIDDEN')
      await client.query('ROLLBACK TO SAVEPOINT negative_outgoing')
    }
    if (!outgoingRejected) throw new Error('Further outgoing from a negative opened account was not rejected')
    await client.query('DELETE FROM financial_transactions WHERE id=$1', [outgoing.id])

    const postedOpening = (await client.query('SELECT * FROM financial_transactions WHERE id=$1', [opening.id])).rows[0]
    await createReversal(client, postedOpening)
  } finally {
    await client.query('ROLLBACK')
  }
}

const verifyDebtSettlementConcurrency = async (client, original) => {
  const contact = (await client.query(
    `INSERT INTO contacts (financial_space_id,name) VALUES ($1,'Debt concurrency probe') RETURNING id`,
    [original.financial_space_id]
  )).rows[0]
  const cash = (await client.query(
    `SELECT id FROM ledger_accounts WHERE financial_space_id=$1 AND kind='USER_BALANCE' AND current_balance>=100 ORDER BY id LIMIT 1`,
    [original.financial_space_id]
  )).rows[0]
  const liability = (await client.query(
    `SELECT id FROM ledger_accounts WHERE financial_space_id=$1 AND system_role='BORROWING_LIABILITY'`,
    [original.financial_space_id]
  )).rows[0]
  const borrowingTemplate = (await client.query(`SELECT id FROM posting_template_definitions WHERE code='BORROWING' AND status='APPROVED'`)).rows[0]
  const incomeTemplate = (await client.query(`SELECT id FROM posting_template_definitions WHERE code='INCOME' AND status='APPROVED'`)).rows[0]
  const localContact = (await client.query(
    `SELECT id FROM contacts WHERE financial_space_id=$1 ORDER BY id LIMIT 1`, [original.financial_space_id]
  )).rows[0]
  const repaymentTemplate = (await client.query(`SELECT id FROM posting_template_definitions WHERE code='REPAYMENT' AND status='APPROVED'`)).rows[0]
  const loanTemplate = (await client.query(`SELECT id FROM posting_template_definitions WHERE code='LOAN_DISBURSEMENT' AND status='APPROVED'`)).rows[0]
  const collectionTemplate = (await client.query(`SELECT id FROM posting_template_definitions WHERE code='COLLECTION' AND status='APPROVED'`)).rows[0]
  const receivableLedger = (await client.query(
    `SELECT id FROM ledger_accounts WHERE financial_space_id=$1 AND system_role='LOAN_RECEIVABLE'`, [original.financial_space_id]
  )).rows[0]

  await client.query('BEGIN')
  const origin = (await client.query(
    `INSERT INTO financial_transactions (financial_space_id,posting_template_definition_id,type,status,responsible_user_id,name,amount,occurred_at,business_snapshot,snapshot_schema_version,correlation_id)
     VALUES ($1,$2,'BORROWING','DRAFT',$3,'Borrowing concurrency probe',100,clock_timestamp(),'{}',1,$4) RETURNING id`,
    [original.financial_space_id, borrowingTemplate.id, original.responsible_user_id, randomUUID()]
  )).rows[0]
  const debt = (await client.query(
    `INSERT INTO debt_agreements (financial_space_id,origin_transaction_id,direction,cash_ledger_account_id,debt_ledger_account_id,counterparty_contact_id,principal_amount,rate_basis,status,outstanding_principal,outstanding_interest)
     VALUES ($1,$2,'PAYABLE',$3,$4,$5,100,'UNSPECIFIED','OPEN',100,0) RETURNING id`,
    [original.financial_space_id, origin.id, cash.id, liability.id, contact.id]
  )).rows[0]
  await client.query('SAVEPOINT origin_not_posted')
  const prematureSettlementTransaction = (await client.query(
    `INSERT INTO financial_transactions (financial_space_id,posting_template_definition_id,type,status,responsible_user_id,name,amount,occurred_at,business_snapshot,snapshot_schema_version,correlation_id)
     VALUES ($1,$2,'REPAYMENT','DRAFT',$3,'Premature repayment probe',100,clock_timestamp(),'{}',1,$4) RETURNING id`,
    [original.financial_space_id, repaymentTemplate.id, original.responsible_user_id, randomUUID()]
  )).rows[0]
  let prematureRejected = false
  try {
    await client.query(
      `INSERT INTO debt_settlements (financial_space_id,financial_transaction_id,debt_agreement_id,cash_ledger_account_id,principal_amount,interest_amount,occurred_at)
       VALUES ($1,$2,$3,$4,100,0,clock_timestamp())`,
      [original.financial_space_id, prematureSettlementTransaction.id, debt.id, cash.id]
    )
  } catch (error) {
    prematureRejected = error.code === '23514' && error.message.includes('DEBT_FULL_SETTLEMENT_REQUIRED')
    await client.query('ROLLBACK TO SAVEPOINT origin_not_posted')
  }
  if (!prematureRejected) throw new Error('Settlement before debt origin POSTED was not rejected')
  await client.query(
    `INSERT INTO ledger_entries (financial_transaction_id,ledger_account_id,account_sequence,amount,balance_before,balance_after,posted_at,entry_role)
     VALUES ($1,$2,1,100,0,100,clock_timestamp(),'CASH_TARGET'),($1,$3,1,-100,0,-100,clock_timestamp(),'BORROWING_LIABILITY')`,
    [origin.id, cash.id, liability.id]
  )
  await client.query(`UPDATE financial_transactions SET status='POSTED' WHERE id=$1`, [origin.id])
  await client.query('COMMIT')

  const postedOrigin = (await client.query('SELECT * FROM financial_transactions WHERE id=$1', [origin.id])).rows[0]
  await expectRejected(client, 'DEBT_ORIGIN_REVERSAL_UNSUPPORTED', () => createReversal(client, postedOrigin))

  await expectRejected(client, 'DEBT_FULL_SETTLEMENT_REQUIRED', async () => {
    const partial = (await client.query(
      `INSERT INTO financial_transactions (financial_space_id,posting_template_definition_id,type,status,responsible_user_id,name,amount,occurred_at,business_snapshot,snapshot_schema_version,correlation_id)
       VALUES ($1,$2,'REPAYMENT','DRAFT',$3,'Partial repayment probe',50,clock_timestamp(),'{}',1,$4) RETURNING id`,
      [original.financial_space_id, repaymentTemplate.id, original.responsible_user_id, randomUUID()]
    )).rows[0]
    await client.query(
      `INSERT INTO debt_settlements (financial_space_id,financial_transaction_id,debt_agreement_id,cash_ledger_account_id,principal_amount,interest_amount,occurred_at)
       VALUES ($1,$2,$3,$4,50,0,clock_timestamp())`,
      [original.financial_space_id, partial.id, debt.id, cash.id]
    )
  })

  const contender = new Client({ connectionString })
  await contender.connect()
  try {
    await client.query('BEGIN')
    await contender.query('BEGIN')
    const createRepaymentHeader = async (db, name) => (await db.query(
      `INSERT INTO financial_transactions (financial_space_id,posting_template_definition_id,type,status,responsible_user_id,name,amount,occurred_at,business_snapshot,snapshot_schema_version,correlation_id)
       VALUES ($1,$2,'REPAYMENT','DRAFT',$3,$4,100,clock_timestamp(),'{}',1,$5) RETURNING id`,
      [original.financial_space_id, repaymentTemplate.id, original.responsible_user_id, name, randomUUID()]
    )).rows[0]
    const winner = await createRepaymentHeader(client, 'Winning repayment probe')
    const loser = await createRepaymentHeader(contender, 'Concurrent repayment probe')
    await client.query(
      `INSERT INTO debt_settlements (financial_space_id,financial_transaction_id,debt_agreement_id,cash_ledger_account_id,principal_amount,interest_amount,occurred_at)
       VALUES ($1,$2,$3,$4,100,0,clock_timestamp())`,
      [original.financial_space_id, winner.id, debt.id, cash.id]
    )
    await client.query(
      `INSERT INTO ledger_entries (financial_transaction_id,ledger_account_id,account_sequence,amount,balance_before,balance_after,posted_at,entry_role)
       VALUES ($1,$2,1,-100,0,-100,clock_timestamp(),'CASH_SOURCE'),($1,$3,1,100,0,100,clock_timestamp(),'BORROWING_LIABILITY')`,
      [winner.id, cash.id, liability.id]
    )
    await client.query(`UPDATE financial_transactions SET status='POSTED' WHERE id=$1`, [winner.id])
    const losingInsert = contender.query(
      `INSERT INTO debt_settlements (financial_space_id,financial_transaction_id,debt_agreement_id,cash_ledger_account_id,principal_amount,interest_amount,occurred_at)
       VALUES ($1,$2,$3,$4,100,0,clock_timestamp())`,
      [original.financial_space_id, loser.id, debt.id, cash.id]
    )
    await new Promise((resolve) => setImmediate(resolve))
    await client.query('COMMIT')
    let loserRejected = false
    try { await losingInsert } catch (error) {
      loserRejected = error.code === '23514' && error.message.includes('DEBT_FULL_SETTLEMENT_REQUIRED')
    }
    if (!loserRejected) throw new Error('Concurrent second debt settlement was not rejected')
    await contender.query('ROLLBACK')

    await client.query('BEGIN')
    const postedWinner = (await client.query('SELECT * FROM financial_transactions WHERE id=$1', [winner.id])).rows[0]
    await createReversal(client, postedWinner)
    await client.query('SET CONSTRAINTS ALL DEFERRED')
    const replacement = await createRepaymentHeader(client, 'Post-reversal repayment probe')
    await client.query(
      `INSERT INTO debt_settlements (financial_space_id,financial_transaction_id,debt_agreement_id,cash_ledger_account_id,principal_amount,interest_amount,occurred_at)
       VALUES ($1,$2,$3,$4,100,0,clock_timestamp())`,
      [original.financial_space_id, replacement.id, debt.id, cash.id]
    )
    await client.query('ROLLBACK')
  } finally {
    await contender.end()
  }

  await client.query('BEGIN')
  const loanOrigin = (await client.query(
    `INSERT INTO financial_transactions (financial_space_id,posting_template_definition_id,type,status,responsible_user_id,name,amount,occurred_at,business_snapshot,snapshot_schema_version,correlation_id)
     VALUES ($1,$2,'LOAN_DISBURSEMENT','DRAFT',$3,'Receivable direction probe',75,clock_timestamp(),'{}',1,$4) RETURNING id`,
    [original.financial_space_id, loanTemplate.id, original.responsible_user_id, randomUUID()]
  )).rows[0]
  const receivableDebt = (await client.query(
    `INSERT INTO debt_agreements (financial_space_id,origin_transaction_id,direction,cash_ledger_account_id,debt_ledger_account_id,counterparty_contact_id,principal_amount,rate_basis,status,outstanding_principal,outstanding_interest)
     VALUES ($1,$2,'RECEIVABLE',$3,$4,$5,75,'UNSPECIFIED','OPEN',75,0) RETURNING id`,
    [original.financial_space_id, loanOrigin.id, cash.id, receivableLedger.id, contact.id]
  )).rows[0]
  await client.query(
    `INSERT INTO ledger_entries (financial_transaction_id,ledger_account_id,account_sequence,amount,balance_before,balance_after,posted_at,entry_role)
     VALUES ($1,$2,1,-75,0,-75,clock_timestamp(),'CASH_SOURCE'),($1,$3,1,75,0,75,clock_timestamp(),'LOAN_RECEIVABLE')`,
    [loanOrigin.id, cash.id, receivableLedger.id]
  )
  await client.query(`UPDATE financial_transactions SET status='POSTED' WHERE id=$1`, [loanOrigin.id])
  await client.query('COMMIT')

  await expectRejected(client, 'DEBT_FULL_SETTLEMENT_REQUIRED', async () => {
    const wrongDirection = (await client.query(
      `INSERT INTO financial_transactions (financial_space_id,posting_template_definition_id,type,status,responsible_user_id,name,amount,occurred_at,business_snapshot,snapshot_schema_version,correlation_id)
       VALUES ($1,$2,'REPAYMENT','DRAFT',$3,'Wrong receivable direction',75,clock_timestamp(),'{}',1,$4) RETURNING id`,
      [original.financial_space_id, repaymentTemplate.id, original.responsible_user_id, randomUUID()]
    )).rows[0]
    await client.query(
      `INSERT INTO debt_settlements (financial_space_id,financial_transaction_id,debt_agreement_id,cash_ledger_account_id,principal_amount,interest_amount,occurred_at)
       VALUES ($1,$2,$3,$4,75,0,clock_timestamp())`,
      [original.financial_space_id, wrongDirection.id, receivableDebt.id, cash.id]
    )
  })

  await client.query('BEGIN')
  const collection = (await client.query(
    `INSERT INTO financial_transactions (financial_space_id,posting_template_definition_id,type,status,responsible_user_id,name,amount,occurred_at,business_snapshot,snapshot_schema_version,correlation_id)
     VALUES ($1,$2,'COLLECTION','DRAFT',$3,'Receivable collection probe',75,clock_timestamp(),'{}',1,$4) RETURNING id`,
    [original.financial_space_id, collectionTemplate.id, original.responsible_user_id, randomUUID()]
  )).rows[0]
  await client.query(
    `INSERT INTO debt_settlements (financial_space_id,financial_transaction_id,debt_agreement_id,cash_ledger_account_id,principal_amount,interest_amount,occurred_at)
     VALUES ($1,$2,$3,$4,75,0,clock_timestamp())`,
    [original.financial_space_id, collection.id, receivableDebt.id, cash.id]
  )
  await client.query(
    `INSERT INTO ledger_entries (financial_transaction_id,ledger_account_id,account_sequence,amount,balance_before,balance_after,posted_at,entry_role)
     VALUES ($1,$2,1,75,0,75,clock_timestamp(),'CASH_TARGET'),($1,$3,1,-75,0,-75,clock_timestamp(),'LOAN_RECEIVABLE')`,
    [collection.id, cash.id, receivableLedger.id]
  )
  await client.query(`UPDATE financial_transactions SET status='POSTED' WHERE id=$1`, [collection.id])
  await client.query('COMMIT')
  const receivableState = (await client.query(
    `SELECT status,outstanding_principal FROM debt_agreements WHERE id=$1`, [receivableDebt.id]
  )).rows[0]
  if (receivableState.status !== 'SETTLED' || BigInt(receivableState.outstanding_principal) !== 0n) {
    throw new Error('Receivable full collection did not reach SETTLED/zero state')
  }
}

const verifyCommittedGlobalAssetIsolation = async (client, original) => {
  const assetWriter = new Client({ connectionString })
  await assetWriter.connect()
  let asset
  try {
    asset = (await assetWriter.query(
      `INSERT INTO temporary_assets (owner_user_id,financial_space_id,upload_session_id,provider,secure_url,status)
       VALUES ($1,NULL,$2,'TEST','https://example.invalid/global-only','TEMPORARY') RETURNING id`,
      [original.responsible_user_id, randomUUID()]
    )).rows[0]
  } finally {
    await assetWriter.end()
  }
  await expectRejected(client, 'ATTACHMENT_BUSINESS_ASSET_SPACE_REQUIRED', async () => {
    await client.query(
      `INSERT INTO attachments (asset_id,financial_space_id,financial_transaction_id,role,source_ordinal,status,linked_by_user_id)
       VALUES ($1,$2,$3,'NULL_SPACE_PROBE',0,'PENDING',$4)`,
      [asset.id, original.financial_space_id, original.id, original.responsible_user_id]
    )
    await client.query('SET CONSTRAINTS "attachments_scope_guard" IMMEDIATE')
  })
}

const verifyCrossAggregateScopes = async (client, original) => {
  await client.query('BEGIN')
  try {
  const otherUser = (await client.query(
    `INSERT INTO users (email,email_normalized,password_hash,username,username_normalized,display_name,status)
     VALUES ($1,$1,'probe-hash',$2,$2,'Cross-space probe','ACTIVE') RETURNING id`,
    [`cross-${randomUUID()}@example.invalid`, `cross-${randomUUID()}`]
  )).rows[0]
  const otherSpace = (await client.query(
    `INSERT INTO financial_spaces (kind,name,status) VALUES ('FAMILY','Cross-space probe','ACTIVE') RETURNING id`
  )).rows[0]
  await client.query(
    `INSERT INTO financial_space_memberships (financial_space_id,user_id,role,status,joined_at)
     VALUES ($1,$2,'OWNER','ACTIVE',clock_timestamp())`, [otherSpace.id, otherUser.id]
  )
  await client.query(
    `INSERT INTO financial_space_memberships (financial_space_id,user_id,role,status,joined_at)
     VALUES ($1,$2,'MEMBER','ACTIVE',clock_timestamp())`, [otherSpace.id, original.responsible_user_id]
  )
  const otherContact = (await client.query(
    `INSERT INTO contacts (financial_space_id,name) VALUES ($1,'Cross-space contact') RETURNING id`, [otherSpace.id]
  )).rows[0]
  const cash = (await client.query(
    `SELECT id FROM ledger_accounts WHERE financial_space_id=$1 AND kind='USER_BALANCE' ORDER BY id LIMIT 1`, [original.financial_space_id]
  )).rows[0]
  const liability = (await client.query(
    `SELECT id FROM ledger_accounts WHERE financial_space_id=$1 AND system_role='BORROWING_LIABILITY'`, [original.financial_space_id]
  )).rows[0]
  const borrowingTemplate = (await client.query(`SELECT id FROM posting_template_definitions WHERE code='BORROWING' AND status='APPROVED'`)).rows[0]
  const incomeTemplate = (await client.query(`SELECT id FROM posting_template_definitions WHERE code='INCOME' AND status='APPROVED'`)).rows[0]
  const repaymentTemplate = (await client.query(`SELECT id FROM posting_template_definitions WHERE code='REPAYMENT' AND status='APPROVED'`)).rows[0]
  const localContact = (await client.query(
    `SELECT id FROM contacts WHERE financial_space_id=$1 ORDER BY id LIMIT 1`, [original.financial_space_id]
  )).rows[0]

  for (const invalidState of [
    { status: 'SETTLED', outstanding: 0, interest: 0, settledAt: new Date() },
    { status: 'ARCHIVED', outstanding: 10, interest: 0, settledAt: null },
    { status: 'OPEN', outstanding: 0, interest: 0, settledAt: null },
    { status: 'OPEN', outstanding: 5, interest: 0, settledAt: null }
  ]) {
    await expectRejectedAtSavepoint(client, 'DEBT_INITIAL_STATE_INVALID', async () => {
      const origin = (await client.query(
        `INSERT INTO financial_transactions (financial_space_id,posting_template_definition_id,type,status,responsible_user_id,name,amount,occurred_at,business_snapshot,snapshot_schema_version,correlation_id)
         VALUES ($1,$2,'BORROWING','DRAFT',$3,'Invalid debt initial state',10,clock_timestamp(),'{}',1,$4) RETURNING id`,
        [original.financial_space_id, borrowingTemplate.id, original.responsible_user_id, randomUUID()]
      )).rows[0]
      await client.query(
        `INSERT INTO debt_agreements (financial_space_id,origin_transaction_id,direction,cash_ledger_account_id,debt_ledger_account_id,counterparty_contact_id,principal_amount,rate_basis,status,outstanding_principal,outstanding_interest,settled_at)
         VALUES ($1,$2,'PAYABLE',$3,$4,$5,10,'UNSPECIFIED',$6,$7,$8,$9)`,
        [original.financial_space_id, origin.id, cash.id, liability.id, localContact.id,
          invalidState.status, invalidState.outstanding, invalidState.interest, invalidState.settledAt]
      )
    })
  }

  for (const invalidState of [
    { status: 'SETTLED', outstanding: 0, settledAt: new Date() },
    { status: 'ARCHIVED', outstanding: 10, settledAt: null },
    { status: 'OPEN', outstanding: 0, settledAt: null },
    { status: 'OPEN', outstanding: 5, settledAt: null }
  ]) {
    await expectRejectedAtSavepoint(client, 'DEBT_ORIGIN_INITIAL_STATE_INVALID', async () => {
      const origin = (await client.query(
        `INSERT INTO financial_transactions (financial_space_id,posting_template_definition_id,type,status,responsible_user_id,name,amount,occurred_at,business_snapshot,snapshot_schema_version,correlation_id)
         VALUES ($1,$2,'BORROWING','DRAFT',$3,'Invalid legacy debt posting',10,clock_timestamp(),'{}',1,$4) RETURNING id`,
        [original.financial_space_id, borrowingTemplate.id, original.responsible_user_id, randomUUID()]
      )).rows[0]
      await client.query(
        `INSERT INTO debt_agreements (legacy_mongo_id,financial_space_id,origin_transaction_id,direction,cash_ledger_account_id,debt_ledger_account_id,counterparty_contact_id,principal_amount,rate_basis,status,outstanding_principal,outstanding_interest,settled_at)
         VALUES ($1,$2,$3,'PAYABLE',$4,$5,$6,10,'UNSPECIFIED',$7,$8,0,$9)`,
        [randomUUID().replaceAll('-', '').slice(0, 24), original.financial_space_id, origin.id, cash.id, liability.id,
          localContact.id, invalidState.status, invalidState.outstanding, invalidState.settledAt]
      )
      const accountStates = (await client.query(
        `SELECT id,current_balance,current_sequence FROM ledger_accounts WHERE id=ANY($1::bigint[]) ORDER BY id`,
        [[cash.id, liability.id]]
      )).rows
      for (const state of accountStates) {
        const isCash = String(state.id) === String(cash.id)
        const amount = isCash ? 10n : -10n
        const before = BigInt(state.current_balance)
        await client.query(
          `INSERT INTO ledger_entries (financial_transaction_id,ledger_account_id,account_sequence,amount,balance_before,balance_after,posted_at,entry_role)
           VALUES ($1,$2,$3,$4,$5,$6,clock_timestamp(),$7)`,
          [origin.id, state.id, (BigInt(state.current_sequence) + 1n).toString(), amount.toString(), before.toString(),
            (before + amount).toString(), isCash ? 'CASH_TARGET' : 'BORROWING_LIABILITY']
        )
      }
      await client.query(`UPDATE financial_transactions SET status='POSTED' WHERE id=$1`, [origin.id])
      await client.query('SET CONSTRAINTS ALL IMMEDIATE')
    })
  }

  const derivedOrigin = (await client.query(
    `INSERT INTO financial_transactions (financial_space_id,posting_template_definition_id,type,status,responsible_user_id,name,amount,occurred_at,business_snapshot,snapshot_schema_version,correlation_id)
     VALUES ($1,$2,'BORROWING','DRAFT',$3,'Derived debt initial state',10,clock_timestamp(),'{}',1,$4) RETURNING id`,
    [original.financial_space_id, borrowingTemplate.id, original.responsible_user_id, randomUUID()]
  )).rows[0]
  const derivedDebt = (await client.query(
    `INSERT INTO debt_agreements (financial_space_id,origin_transaction_id,direction,cash_ledger_account_id,debt_ledger_account_id,counterparty_contact_id,principal_amount,rate_basis)
     VALUES ($1,$2,'PAYABLE',$3,$4,$5,10,'UNSPECIFIED') RETURNING status,outstanding_principal,outstanding_interest,settled_at`,
    [original.financial_space_id, derivedOrigin.id, cash.id, liability.id, localContact.id]
  )).rows[0]
  if (derivedDebt.status !== 'OPEN' || BigInt(derivedDebt.outstanding_principal) !== 10n ||
      BigInt(derivedDebt.outstanding_interest) !== 0n || derivedDebt.settled_at !== null) {
    throw new Error('Debt initial projection was not derived at the database boundary')
  }

  await expectRejectedAtSavepoint(client, 'DEBT_CONTACT_SPACE_MISMATCH', async () => {
    const origin = (await client.query(
      `INSERT INTO financial_transactions (financial_space_id,posting_template_definition_id,type,status,responsible_user_id,name,amount,occurred_at,business_snapshot,snapshot_schema_version,correlation_id)
       VALUES ($1,$2,'BORROWING','DRAFT',$3,'Cross-contact probe',10,clock_timestamp(),'{}',1,$4) RETURNING id`,
      [original.financial_space_id, borrowingTemplate.id, original.responsible_user_id, randomUUID()]
    )).rows[0]
    await client.query(
      `INSERT INTO debt_agreements (financial_space_id,origin_transaction_id,direction,cash_ledger_account_id,debt_ledger_account_id,counterparty_contact_id,principal_amount,rate_basis,status,outstanding_principal,outstanding_interest)
       VALUES ($1,$2,'PAYABLE',$3,$4,$5,10,'UNSPECIFIED','OPEN',10,0)`,
      [original.financial_space_id, origin.id, cash.id, liability.id, otherContact.id]
    )
    await client.query('SET CONSTRAINTS "debt_agreements_contact_space_guard" IMMEDIATE')
  })

  await expectRejectedAtSavepoint(client, 'TYPED_FACT_TRANSACTION_TYPE_MISMATCH', async () => {
    const validOrigin = (await client.query(
      `INSERT INTO financial_transactions (financial_space_id,posting_template_definition_id,type,status,responsible_user_id,name,amount,occurred_at,business_snapshot,snapshot_schema_version,correlation_id)
       VALUES ($1,$2,'BORROWING','DRAFT',$3,'Mutable debt parent probe',10,clock_timestamp(),'{}',1,$4) RETURNING id`,
      [original.financial_space_id, borrowingTemplate.id, original.responsible_user_id, randomUUID()]
    )).rows[0]
    const invalidOrigin = (await client.query(
      `INSERT INTO financial_transactions (financial_space_id,posting_template_definition_id,type,status,responsible_user_id,name,amount,occurred_at,business_snapshot,snapshot_schema_version,correlation_id)
       VALUES ($1,$2,'INCOME','DRAFT',$3,'Invalid debt parent probe',10,clock_timestamp(),'{}',1,$4) RETURNING id`,
      [original.financial_space_id, incomeTemplate.id, original.responsible_user_id, randomUUID()]
    )).rows[0]
    const agreement = (await client.query(
      `INSERT INTO debt_agreements (financial_space_id,origin_transaction_id,direction,cash_ledger_account_id,debt_ledger_account_id,counterparty_contact_id,principal_amount,rate_basis,status,outstanding_principal,outstanding_interest)
       VALUES ($1,$2,'PAYABLE',$3,$4,$5,10,'UNSPECIFIED','OPEN',10,0) RETURNING id`,
      [original.financial_space_id, validOrigin.id, cash.id, liability.id, localContact.id]
    )).rows[0]
    await client.query(`UPDATE debt_agreements SET origin_transaction_id=$2 WHERE id=$1`, [agreement.id, invalidOrigin.id])
  })

  await expectRejectedAtSavepoint(client, 'POSTED_TYPED_FACT_IMMUTABLE', async () => {
    const postedSettlement = (await client.query(
      `SELECT settlement.id FROM debt_settlements settlement
       JOIN financial_transactions transaction ON transaction.id=settlement.financial_transaction_id
       WHERE transaction.status='POSTED' ORDER BY settlement.id LIMIT 1`
    )).rows[0]
    if (!postedSettlement) throw new Error('Posted debt settlement fixture is required')
    const replacementParent = (await client.query(
      `INSERT INTO financial_transactions (financial_space_id,posting_template_definition_id,type,status,responsible_user_id,name,amount,occurred_at,business_snapshot,snapshot_schema_version,correlation_id)
       VALUES ($1,$2,'REPAYMENT','DRAFT',$3,'Settlement rebind probe',100,clock_timestamp(),'{}',1,$4) RETURNING id`,
      [original.financial_space_id, repaymentTemplate.id, original.responsible_user_id, randomUUID()]
    )).rows[0]
    await client.query(`UPDATE debt_settlements SET financial_transaction_id=$2 WHERE id=$1`, [postedSettlement.id, replacementParent.id])
  })

  await expectRejectedAtSavepoint(client, 'POSTED_TYPED_FACT_IMMUTABLE', async () => {
    const draftParent = (await client.query(
      `INSERT INTO financial_transactions (financial_space_id,posting_template_definition_id,type,status,responsible_user_id,name,amount,occurred_at,business_snapshot,snapshot_schema_version,correlation_id)
       VALUES ($1,$2,'INCOME','DRAFT',$3,'Income detail rebind probe',10,clock_timestamp(),'{}',1,$4) RETURNING id`,
      [original.financial_space_id, incomeTemplate.id, original.responsible_user_id, randomUUID()]
    )).rows[0]
    const detail = (await client.query(
      `INSERT INTO transaction_income_details (financial_transaction_id,target_ledger_account_id) VALUES ($1,$2) RETURNING id`,
      [draftParent.id, cash.id]
    )).rows[0]
    await client.query(`UPDATE transaction_income_details SET financial_transaction_id=$2 WHERE id=$1`, [detail.id, original.id])
  })

  await expectRejectedAtSavepoint(client, 'ASSET_OWNER_NOT_ACTIVE_MEMBER', async () => {
    await client.query(
      `INSERT INTO temporary_assets (owner_user_id,financial_space_id,upload_session_id,provider,secure_url,status)
       VALUES ($1,$2,$3,'TEST','https://example.invalid/unauthorized','TEMPORARY')`,
      [otherUser.id, original.financial_space_id, randomUUID()]
    )
    await client.query('SET CONSTRAINTS "temporary_assets_scope_guard" IMMEDIATE')
  })

  const asset = (await client.query(
    `INSERT INTO temporary_assets (owner_user_id,financial_space_id,upload_session_id,provider,secure_url,status)
     VALUES ($1,$2,$3,'TEST','https://example.invalid/owned','TEMPORARY') RETURNING id`,
    [original.responsible_user_id, original.financial_space_id, randomUUID()]
  )).rows[0]
  await expectRejectedAtSavepoint(client, 'ATTACHMENT_LINKER_DOES_NOT_OWN_ASSET', async () => {
    await client.query(
      `INSERT INTO attachments (asset_id,financial_space_id,financial_transaction_id,role,source_ordinal,status,linked_by_user_id)
       VALUES ($1,$2,$3,'CROSS_USER',0,'PENDING',$4)`,
      [asset.id, original.financial_space_id, original.id, otherUser.id]
    )
    await client.query('SET CONSTRAINTS "attachments_scope_guard" IMMEDIATE')
  })
  await client.query(
    `INSERT INTO attachments (asset_id,financial_space_id,financial_transaction_id,role,source_ordinal,status,linked_by_user_id)
     VALUES ($1,$2,$3,'OWNED_PROBE',0,'PENDING',$4)`,
    [asset.id, original.financial_space_id, original.id, original.responsible_user_id]
  )
  await expectRejectedAtSavepoint(client, 'ASSET_SCOPE_CHANGE_INVALIDATES_ATTACHMENT', async () => {
    await client.query(`UPDATE temporary_assets SET financial_space_id=$2 WHERE id=$1`, [asset.id, otherSpace.id])
    await client.query('SET CONSTRAINTS "temporary_assets_scope_guard" IMMEDIATE')
  })

  const bank = (await client.query(`SELECT id FROM banks ORDER BY id LIMIT 1`)).rows[0]
  const createSaving = async (name) => (await client.query(
    `INSERT INTO savings_accounts (
       financial_space_id,bank_id,name,principal_amount,legacy_stored_balance,annual_rate,non_term_annual_rate,
       starts_at,term_months,interest_schedule,maturity_action,funding_ledger_account_id,status
     ) VALUES ($1,$2,$3,100,100,5,1,clock_timestamp(),12,'MATURITY','CLOSE_ACCOUNT',$4,'ACTIVE') RETURNING id`,
    [original.financial_space_id, bank.id, name, cash.id]
  )).rows[0]
  const savingOne = await createSaving('Saving period owner probe')
  const savingTwo = await createSaving('Saving period mismatch probe')
  const period = (await client.query(
    `INSERT INTO saving_periods (saving_account_id,period_ordinal,action,due_at,status,idempotency_key)
     VALUES ($1,1,'MONTHLY_INTEREST',clock_timestamp(),'PENDING',$2) RETURNING id`, [savingTwo.id, randomUUID()]
  )).rows[0]
  const savingTemplate = (await client.query(`SELECT id FROM posting_template_definitions WHERE code='SAVING_DEPOSIT' AND status='APPROVED'`)).rows[0]
  await expectRejectedAtSavepoint(client, 'SAVING_DETAIL_PERIOD_ACCOUNT_MISMATCH', async () => {
    const transaction = (await client.query(
      `INSERT INTO financial_transactions (financial_space_id,posting_template_definition_id,type,status,responsible_user_id,name,amount,occurred_at,business_snapshot,snapshot_schema_version,correlation_id)
       VALUES ($1,$2,'SAVING_DEPOSIT','DRAFT',$3,'Saving period mismatch',100,clock_timestamp(),'{}',1,$4) RETURNING id`,
      [original.financial_space_id, savingTemplate.id, original.responsible_user_id, randomUUID()]
    )).rows[0]
    await client.query(
      `INSERT INTO transaction_saving_details (financial_transaction_id,saving_account_id,saving_period_id,action,source_ledger_account_id,principal_amount,interest_amount,calculation_snapshot,calculation_version)
       VALUES ($1,$2,$3,'DEPOSIT',$4,100,0,'{}',1)`, [transaction.id, savingOne.id, period.id, cash.id]
    )
    await client.query('SET CONSTRAINTS "saving_details_period_account_guard" IMMEDIATE')
  })

  const otherAccount = (await client.query(
    `INSERT INTO accounts (financial_space_id,type,name,legacy_initial_balance,legacy_stored_balance)
     VALUES ($1,'OTHER','Cross-space snapshot account',0,0) RETURNING id`, [otherSpace.id]
  )).rows[0]
  const otherLedger = (await client.query(
    `INSERT INTO ledger_accounts (financial_space_id,kind,normal_side,account_id,name,allows_negative_balance,status)
     VALUES ($1,'USER_BALANCE','DEBIT',$2,'Cross-space snapshot ledger',false,'ACTIVE') RETURNING id`,
    [otherSpace.id, otherAccount.id]
  )).rows[0]
  const snapshotRun = (await client.query(
    `INSERT INTO balance_snapshot_runs (financial_space_id,business_date,trigger_type,status,calculation_version,idempotency_key)
     VALUES ($1,'2026-07-10','MANUAL','PENDING',1,$2) RETURNING id`, [original.financial_space_id, randomUUID()]
  )).rows[0]
  const insertSnapshot = (ledgerId, { runId = snapshotRun.id, financialSpaceId = original.financial_space_id,
    businessDate = '2026-07-10', version = 1, checksum = 'd'.repeat(64), isCurrent = false } = {}) => client.query(
    `INSERT INTO account_balance_snapshots (
       snapshot_run_id,ledger_account_id,financial_space_id,business_date,period_start_utc,period_end_utc,
       opening_balance,total_inflow,total_outflow,closing_balance,cutoff_sequence,cutoff_posted_at,entry_count,
       calculation_version,checksum,status,is_current,generated_at
     ) VALUES ($1,$2,$3,$4,$4::date::timestamp AT TIME ZONE 'UTC',($4::date+1)::timestamp AT TIME ZONE 'UTC',0,0,0,0,0,
       clock_timestamp(),0,$5,$6,'VALID',$7,clock_timestamp()) RETURNING id`,
    [runId, ledgerId, financialSpaceId, businessDate, version, checksum, isCurrent]
  )
  await expectRejectedAtSavepoint(client, 'BALANCE_SNAPSHOT_SCOPE_MISMATCH', async () => {
    await insertSnapshot(otherLedger.id)
    await client.query('SET CONSTRAINTS "account_balance_snapshots_scope_guard" IMMEDIATE')
  })
  const validSnapshot = (await insertSnapshot(cash.id)).rows[0]
  await expectRejectedAtSavepoint(client, 'BALANCE_SNAPSHOT_FACTS_IMMUTABLE', () =>
    client.query(`UPDATE account_balance_snapshots SET opening_balance=1,total_inflow=1,closing_balance=2 WHERE id=$1`, [validSnapshot.id]))
  await expectRejectedAtSavepoint(client, 'BALANCE_SNAPSHOT_DELETE_FORBIDDEN', () =>
    client.query(`DELETE FROM account_balance_snapshots WHERE id=$1`, [validSnapshot.id]))
  await expectRejectedAtSavepoint(client, 'BALANCE_SNAPSHOT_RUN_IDENTITY_IMMUTABLE', () =>
    client.query(`UPDATE balance_snapshot_runs SET business_date='2026-07-11' WHERE id=$1`, [snapshotRun.id]))

  await expectRejectedAtSavepoint(client, 'BALANCE_SNAPSHOT_SUPERSESSION_INVALID', () =>
    client.query(
      `UPDATE account_balance_snapshots SET status='SUPERSEDED',is_current=false,superseded_by_id=id,superseded_at=clock_timestamp() WHERE id=$1`,
      [validSnapshot.id]
    ))
  const successor = (await insertSnapshot(cash.id, { version: 2, checksum: 'e'.repeat(64), isCurrent: true })).rows[0]
  await expectRejectedAtSavepoint(client, 'BALANCE_SNAPSHOT_SUPERSESSION_INVALID', () =>
    client.query(
      `UPDATE account_balance_snapshots SET status='SUPERSEDED',is_current=true,superseded_by_id=$2,superseded_at=clock_timestamp() WHERE id=$1`,
      [validSnapshot.id, successor.id]
    ))
  const alternateLedger = (await client.query(
    `SELECT id FROM ledger_accounts WHERE financial_space_id=$1 AND id<>$2 ORDER BY id LIMIT 1`,
    [original.financial_space_id, cash.id]
  )).rows[0]
  const wrongAccountSuccessor = (await insertSnapshot(alternateLedger.id, { version: 2, checksum: 'f'.repeat(64) })).rows[0]
  await expectRejectedAtSavepoint(client, 'BALANCE_SNAPSHOT_SUCCESSOR_INVALID', () =>
    client.query(
      `UPDATE account_balance_snapshots SET status='SUPERSEDED',is_current=false,superseded_by_id=$2,superseded_at=clock_timestamp() WHERE id=$1`,
      [validSnapshot.id, wrongAccountSuccessor.id]
    ))
  await client.query(
    `UPDATE account_balance_snapshots SET status='SUPERSEDED',is_current=false,superseded_by_id=$2,superseded_at=clock_timestamp() WHERE id=$1`,
    [validSnapshot.id, successor.id]
  )
  await expectRejectedAtSavepoint(client, 'BALANCE_SNAPSHOT_SUPERSESSION_IMMUTABLE', () =>
    client.query(`UPDATE account_balance_snapshots SET superseded_by_id=NULL WHERE id=$1`, [validSnapshot.id]))
  } finally {
    await client.query('ROLLBACK')
  }
}

const verifyDurableStateGuards = async (client, original) => {
  await client.query('BEGIN')
  client.wave2ProbeTransaction = true
  const requestHash = 'a'.repeat(64)
  const idempotency = (await client.query(
    `INSERT INTO idempotency_records (financial_space_id,actor_type,actor_id,operation,idempotency_key,request_hash,status)
     VALUES ($1,'USER',$2,$3,$4,$5,'IN_PROGRESS') RETURNING id,public_id`,
    [original.financial_space_id, String(original.responsible_user_id), `guard-${randomUUID()}`, randomUUID(), requestHash]
  )).rows[0]
  await expectRejected(client, 'IDEMPOTENCY_IDENTITY_IMMUTABLE', () =>
    client.query(`UPDATE idempotency_records SET request_hash=$2 WHERE id=$1`, [idempotency.id, 'b'.repeat(64)]))
  await expectRejected(client, 'IDEMPOTENCY_RESPONSE_RETENTION_TOO_SHORT', () =>
    client.query(
      `UPDATE idempotency_records SET status='COMPLETED',resource_type='FinancialTransaction',resource_public_id=$2,
       response_status=200,response_body='{}',completed_at=clock_timestamp()-interval '1 year',response_purge_after=clock_timestamp()-interval '1 second'
       WHERE id=$1`, [idempotency.id, original.public_id]
    ))
  await client.query(
    `UPDATE idempotency_records SET status='COMPLETED',resource_type='FinancialTransaction',resource_public_id=$2,
      response_status=200,response_body='{}',completed_at=clock_timestamp()-interval '1 year',response_purge_after=NULL WHERE id=$1`,
    [idempotency.id, original.public_id]
  )
  const databaseTimed = (await client.query(
    `SELECT completed_at BETWEEN clock_timestamp()-interval '5 seconds' AND clock_timestamp()+interval '1 second' AS valid
     FROM idempotency_records WHERE id=$1`, [idempotency.id]
  )).rows[0].valid
  if (!databaseTimed) throw new Error('Idempotency completed_at was not derived from database time')
  await expectRejected(client, 'IDEMPOTENCY_TERMINAL_FACTS_IMMUTABLE', () =>
    client.query(`UPDATE idempotency_records SET status='IN_PROGRESS' WHERE id=$1`, [idempotency.id]))
  await expectRejected(client, 'IDEMPOTENCY_TERMINAL_FACTS_IMMUTABLE', () =>
    client.query(`UPDATE idempotency_records SET resource_public_id=$2 WHERE id=$1`, [idempotency.id, randomUUID()]))
  await expectRejected(client, 'IDEMPOTENCY_TERMINAL_FACTS_IMMUTABLE', () =>
    client.query(`UPDATE idempotency_records SET response_status=201 WHERE id=$1`, [idempotency.id]))
  await expectRejected(client, 'IDEMPOTENCY_TERMINAL_FACTS_IMMUTABLE', () =>
    client.query(`UPDATE idempotency_records SET completed_at=clock_timestamp() WHERE id=$1`, [idempotency.id]))
  await expectRejected(client, 'IDEMPOTENCY_TERMINAL_FACTS_IMMUTABLE', () =>
    client.query(`UPDATE idempotency_records SET error_code='REWRITTEN' WHERE id=$1`, [idempotency.id]))
  await expectRejected(client, 'IDEMPOTENCY_TERMINAL_FACTS_IMMUTABLE', () =>
    client.query(`UPDATE idempotency_records SET response_body=NULL,updated_at=clock_timestamp() WHERE id=$1`, [idempotency.id]))

  const historical = (await client.query(
    `INSERT INTO idempotency_records (financial_space_id,actor_type,actor_id,operation,idempotency_key,request_hash,status)
     VALUES ($1,'USER',$2,$3,$4,$5,'IN_PROGRESS') RETURNING id`,
    [original.financial_space_id, String(original.responsible_user_id), `historical-${randomUUID()}`, randomUUID(), '9'.repeat(64)]
  )).rows[0]
  await client.query(
    `UPDATE idempotency_records SET status='COMPLETED',resource_type='FinancialTransaction',resource_public_id=$2,
      response_status=200,response_body='{}',response_purge_after=NULL WHERE id=$1`,
    [historical.id, original.public_id]
  )
  // Dedicated disposable DB only: backdate a coherent terminal fixture while the guard is transactionally disabled.
  await client.query('ALTER TABLE idempotency_records DISABLE TRIGGER idempotency_records_state_guard')
  await client.query(
    `UPDATE idempotency_records SET completed_at=clock_timestamp()-interval '91 days',
     response_purge_after=clock_timestamp()-interval '1 day' WHERE id=$1`, [historical.id]
  )
  await client.query('ALTER TABLE idempotency_records ENABLE TRIGGER idempotency_records_state_guard')
  await client.query(`UPDATE idempotency_records SET response_body=NULL,updated_at=clock_timestamp() WHERE id=$1`, [historical.id])
  await expectRejected(client, 'IDEMPOTENCY_TERMINAL_FACTS_IMMUTABLE', () =>
    client.query(`UPDATE idempotency_records SET updated_at=clock_timestamp() WHERE id=$1`, [historical.id]))

  const invalidTerminal = (await client.query(
    `INSERT INTO idempotency_records (financial_space_id,actor_type,actor_id,operation,idempotency_key,request_hash,status)
     VALUES ($1,'USER',$2,$3,$4,$5,'IN_PROGRESS') RETURNING id`,
    [original.financial_space_id, String(original.responsible_user_id), `invalid-${randomUUID()}`, randomUUID(), 'c'.repeat(64)]
  )).rows[0]
  await expectRejected(client, 'IDEMPOTENCY_COMPLETED_FACTS_REQUIRED', () =>
    client.query(`UPDATE idempotency_records SET status='COMPLETED',completed_at=clock_timestamp() WHERE id=$1`, [invalidTerminal.id]))
  await expectRejected(client, 'IDEMPOTENCY_INSERT_REQUIRES_IN_PROGRESS', () =>
    client.query(
      `INSERT INTO idempotency_records (financial_space_id,actor_type,actor_id,operation,idempotency_key,request_hash,status,completed_at,error_code)
       VALUES ($1,'USER',$2,$3,$4,$5,'FAILED_FINAL',clock_timestamp(),'DIRECT_TERMINAL')`,
      [original.financial_space_id, String(original.responsible_user_id), `direct-${randomUUID()}`, randomUUID(), 'e'.repeat(64)]
    ))
  const failedTerminal = (await client.query(
    `INSERT INTO idempotency_records (financial_space_id,actor_type,actor_id,operation,idempotency_key,request_hash,status)
     VALUES ($1,'USER',$2,$3,$4,$5,'IN_PROGRESS') RETURNING id`,
    [original.financial_space_id, String(original.responsible_user_id), `failed-${randomUUID()}`, randomUUID(), 'f'.repeat(64)]
  )).rows[0]
  await client.query(
    `UPDATE idempotency_records SET status='FAILED_FINAL',response_status=500,error_code='FINAL_FAILURE',completed_at=clock_timestamp()
     WHERE id=$1`, [failedTerminal.id]
  )
  await expectRejected(client, 'IDEMPOTENCY_TERMINAL_FACTS_IMMUTABLE', () =>
    client.query(`UPDATE idempotency_records SET error_code='CHANGED_FAILURE' WHERE id=$1`, [failedTerminal.id]))

  const event = (await client.query(
    `INSERT INTO outbox_events (financial_space_id,aggregate_type,aggregate_public_id,aggregate_sequence,event_type,event_schema_version,payload)
     VALUES ($1,'FinancialTransaction',$2,1,'probe.created',1,'{}') RETURNING id,public_id`,
    [original.financial_space_id, randomUUID()]
  )).rows[0]
  await expectRejected(client, 'OUTBOX_EVENT_INTENT_IMMUTABLE', () =>
    client.query(`UPDATE outbox_events SET payload='{"changed":true}' WHERE id=$1`, [event.id]))
  await client.query(
    `UPDATE outbox_events SET status='PROCESSING',lease_owner='probe',lease_expires_at=clock_timestamp()+interval '1 minute' WHERE id=$1`,
    [event.id]
  )
  const attempt = (await client.query(
    `INSERT INTO outbox_delivery_attempts (outbox_event_id,attempt_number,provider,provider_idempotency_key,status,started_at)
     VALUES ($1,1,'TEST',$2,'STARTED',clock_timestamp()) RETURNING id`, [event.id, event.public_id]
  )).rows[0]
  await client.query(`UPDATE outbox_delivery_attempts SET status='SUCCEEDED',finished_at=clock_timestamp() WHERE id=$1`, [attempt.id])
  await expectRejected(client, 'OUTBOX_ATTEMPT_TERMINAL_STATE_IMMUTABLE', () =>
    client.query(`UPDATE outbox_delivery_attempts SET status='FAILED' WHERE id=$1`, [attempt.id]))
  await client.query(
    `UPDATE outbox_events SET status='DELIVERED',lease_owner=NULL,lease_expires_at=NULL,delivered_at=clock_timestamp() WHERE id=$1`,
    [event.id]
  )
  await expectRejected(client, 'OUTBOX_TERMINAL_STATE_IMMUTABLE', () =>
    client.query(`UPDATE outbox_events SET status='PENDING',delivered_at=NULL WHERE id=$1`, [event.id]))

  await expectRejected(client, 'POSTED_TYPED_FACT_IMMUTABLE', () =>
    client.query(
      `UPDATE transaction_income_details SET target_ledger_account_id=target_ledger_account_id
       WHERE financial_transaction_id=$1`, [original.id]
    ))

  await expectRejected(client, 'USER_HAS_MULTIPLE_ACTIVE_PERSONAL_SPACES', async () => {
    const secondSpace = (await client.query(
      `INSERT INTO financial_spaces (kind,name,status) VALUES ('PERSONAL','Second personal probe','ACTIVE') RETURNING id`
    )).rows[0]
    await client.query(
      `INSERT INTO financial_space_memberships (financial_space_id,user_id,role,status,joined_at)
       VALUES ($1,$2,'OWNER','ACTIVE',clock_timestamp())`, [secondSpace.id, original.responsible_user_id]
    )
    await client.query('SET CONSTRAINTS ALL IMMEDIATE')
  })

  await client.query('ROLLBACK')
  client.wave2ProbeTransaction = false

  const ownershipUser = (await client.query(
    `INSERT INTO users (email,email_normalized,password_hash,username,username_normalized,display_name,status)
     VALUES ($1,$1,'probe-hash',$2,$2,'Ownership concurrency probe','ACTIVE') RETURNING id`,
    [`ownership-${randomUUID()}@example.invalid`, `ownership-${randomUUID()}`]
  )).rows[0]
  const ownershipContender = new Client({ connectionString })
  await ownershipContender.connect()
  try {
    await client.query('BEGIN')
    await ownershipContender.query('BEGIN')
    const createPersonalOwnership = async (db, name) => {
      const space = (await db.query(
        `INSERT INTO financial_spaces (kind,name,status) VALUES ('PERSONAL',$1,'ACTIVE') RETURNING id`, [name]
      )).rows[0]
      await db.query(
        `INSERT INTO financial_space_memberships (financial_space_id,user_id,role,status,joined_at)
         VALUES ($1,$2,'OWNER','ACTIVE',clock_timestamp())`, [space.id, ownershipUser.id]
      )
    }
    await createPersonalOwnership(client, 'Winning personal ownership')
    await createPersonalOwnership(ownershipContender, 'Concurrent personal ownership')
    await client.query('COMMIT')
    let concurrentOwnerRejected = false
    try { await ownershipContender.query('COMMIT') } catch (error) {
      concurrentOwnerRejected = error.code === '23514' && error.message.includes('USER_HAS_MULTIPLE_ACTIVE_PERSONAL_SPACES')
    }
    if (!concurrentOwnerRejected) throw new Error('Concurrent second personal ownership was not rejected')
    await ownershipContender.query('ROLLBACK').catch(() => undefined)
  } finally {
    await ownershipContender.end()
  }

  const nonIdentityCount = Number((await client.query(
    `SELECT count(*) FROM information_schema.columns
     WHERE table_schema='public' AND table_name<>'_prisma_migrations' AND column_name='id'
       AND data_type='bigint' AND (is_identity<>'YES' OR identity_generation<>'ALWAYS')`
  )).rows[0].count)
  if (nonIdentityCount !== 0) throw new Error(`GENERATED_ALWAYS_IDENTITY_MISMATCH count=${nonIdentityCount}`)
  const snapshotPeriodDefinition = (await client.query(
    `SELECT pg_get_constraintdef(oid) definition FROM pg_constraint
     WHERE conname='account_balance_snapshots_period_check'`
  )).rows[0]?.definition || ''
  if (!snapshotPeriodDefinition.includes("AT TIME ZONE 'UTC'") || !snapshotPeriodDefinition.includes('business_date')) {
    throw new Error('Snapshot period constraint does not enforce UTC midnight boundaries')
  }
}

const run = async () => {
  const client = new Client({ connectionString })
  await client.connect()
  try {
    await assertDisposableMarker(client)
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

    await verifyDebtSettlementConcurrency(client, original)
    await verifyCommittedGlobalAssetIsolation(client, original)
    await verifyCrossAggregateScopes(client, original)
    await verifyDurableStateGuards(client, original)

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
    await expectRejected(client, 'TYPED_FACT_TRANSACTION_TYPE_MISMATCH', () =>
      createIncomeProbe(client, original, { type: 'EXPENSE' })
    )

    const originalOpening = (await client.query(
      `SELECT transaction.* FROM financial_transactions transaction
       JOIN posting_template_definitions template ON template.id=transaction.posting_template_definition_id
       WHERE template.code='OPENING_BALANCE' AND transaction.status='POSTED' ORDER BY transaction.id LIMIT 1`
    )).rows[0]
    await verifyNegativeOpeningPolicy(client, originalOpening)
    await client.query('BEGIN')
    await createMigrationOpeningProbe(client, originalOpening)
    await client.query('ROLLBACK')
    await expectRejected(client, 'OPENING_EQUITY_ROLE_XOR_REQUIRED', () =>
      createMigrationOpeningProbe(client, originalOpening, { includeAnchor: false })
    )

    process.stdout.write('Wave 2 financial guards PASS: projection, signed opening, debt concurrency, exact reversal, typed posting semantics and audited migration anchor.\n')
  } finally {
    await client.end()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
