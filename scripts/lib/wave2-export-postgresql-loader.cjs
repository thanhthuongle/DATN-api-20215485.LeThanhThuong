const { randomUUID } = require('node:crypto')
const { canonicalJson, sha256 } = require('./wave2-export-manifest.cjs')
const { DECLARED_COLLECTIONS } = require('./wave2-export-reader.cjs')
const { materializeSanitizedEvidence } = require('./wave2-export-sanitizer.cjs')

const MAPPING_VERSION = 'wave2-export-postgresql-v1'
const SCHEMA_VERSION = '20260802125000'
const EXPECTED_COUNTS = Object.freeze({ source: 763, loaded: 756, archived: 7, postings: 128, entries: 256 })
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', 'host.docker.internal', '[::1]', '::1'])
const SUPPORTED_TRANSACTION_TEMPLATES = new Set(['OPENING_BALANCE', 'INCOME', 'EXPENSE', 'LOAN_DISBURSEMENT'])
const runnerOwnedCapabilities = new WeakSet()
const CHECKPOINT_GRAPH_LEVEL = Object.freeze({
  users: 2,
  families: 4,
  banks: 5,
  categories: 5,
  money_sources: 7,
  accounts: 8,
  accumulations: 8,
  savings_accounts: 8,
  transactions: 11,
  expenses: 12,
  incomes: 12,
  transfers: 12,
  contributions: 12,
  loans: 13,
  borrowings: 13,
  collections: 14,
  repayments: 14,
  contacts: 5,
  budgets: 10,
  notifications: 15,
  user_notifications: 15,
  contribution_requests: 17,
  group_payouts: 17,
  invitations: 17,
  proposal_expenses: 17,
  system_tasks: 17
})

const legacyIdOf = (value) => {
  if (typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value)) return value.toLowerCase()
  if (value && typeof value.toHexString === 'function') return value.toHexString().toLowerCase()
  return null
}
const numberOf = (value) => {
  const converted = value && typeof value.valueOf === 'function' ? value.valueOf() : value
  if (!Number.isSafeInteger(converted)) throw new Error(`BLOCKING_INVALID_INTEGER ${String(converted)}`)
  return converted
}
const instantOf = (value) => {
  if (value == null) return null
  const converted = value instanceof Date ? value : new Date(numberOf(value))
  if (Number.isNaN(converted.getTime())) throw new Error('BLOCKING_INVALID_INSTANT')
  return converted.toISOString()
}
const nullableInstantOf = (value) => value == null ? null : instantOf(value)
const normalizeText = (value) => String(value).trim().normalize('NFKC')
const normalizedKey = (value) => normalizeText(value).toLowerCase()
const json = (value) => JSON.stringify(value)

const assertDisposableUrl = (connectionString) => {
  const parsed = new URL(connectionString)
  if (!LOCAL_HOSTS.has(parsed.hostname) || /supabase|pooler|amazonaws|azure|neon\.tech/i.test(connectionString)) {
    throw new Error(`NON_DISPOSABLE_DATABASE_HOST ${parsed.hostname}`)
  }
  const safeQueryKeys = new Set(['schema'])
  const rejectedQueryKey = [...parsed.searchParams.keys()].find((key) => !safeQueryKeys.has(key))
  if (rejectedQueryKey) throw new Error(`NON_DISPOSABLE_DATABASE_QUERY ${rejectedQueryKey}`)
  const databaseName = decodeURIComponent(parsed.pathname).split('/').filter(Boolean).at(-1)?.toLowerCase()
  const disposableName = databaseName === 'wave2' || databaseName === 'hey_money_v2_test' ||
    /^[a-z0-9]+(?:[_-][a-z0-9]+)*_(?:test|disposable)$/.test(databaseName || '')
  if (!disposableName) throw new Error('NON_DISPOSABLE_DATABASE_NAME')
  return connectionString
}

const createTestcontainerCapability = (container, connectionString) => {
  if (!container || typeof container.getConnectionUri !== 'function' || typeof container.stop !== 'function' ||
      container.getConnectionUri() !== connectionString) {
    throw new Error('TESTCONTAINER_CAPABILITY_REQUIRED')
  }
  assertDisposableUrl(connectionString)
  const capability = Object.freeze({})
  runnerOwnedCapabilities.add(capability)
  return capability
}

const assertDisposableDatabase = async (client, connectionString, markerToken) => {
  assertDisposableUrl(connectionString)
  if (!/^[0-9a-f-]{36}$/i.test(markerToken || '')) throw new Error('DISPOSABLE_MARKER_TOKEN_REQUIRED')
  const migrations = await client.query(`SELECT migration_name,finished_at,rolled_back_at
    FROM _prisma_migrations ORDER BY finished_at NULLS LAST`)
  if (!migrations.rows.length || migrations.rows.some((row) => !row.finished_at || row.rolled_back_at) ||
      migrations.rows.at(-1).migration_name !== `${SCHEMA_VERSION}_wave2_contract_hardening`) {
    throw new Error('CLEAN_MIGRATION_DEPLOY_REQUIRED')
  }
  const markerTable = (await client.query('SELECT to_regclass(\'public.wave2_disposable_database_markers\')::text name')).rows[0]?.name
  if (!markerTable) throw new Error('DISPOSABLE_MARKER_TABLE_REQUIRED')
  const marker = await client.query(`SELECT 1 FROM wave2_disposable_database_markers
    WHERE token=$1::uuid AND database_name=current_database() AND database_owner=current_user
      AND purpose='WAVE2_EXPORT_LOAD' AND expires_at>clock_timestamp()`, [markerToken])
  if (!marker.rowCount) throw new Error('DISPOSABLE_MARKER_INVALID')
  const definitions = await client.query(`SELECT
    (SELECT count(*)::int FROM system_account_definitions) system_count,
    (SELECT count(*)::int FROM posting_template_definitions WHERE status='APPROVED') template_count`)
  if (definitions.rows[0].system_count !== 8 || definitions.rows[0].template_count !== 18) {
    throw new Error('IDEMPOTENT_SEED_REQUIRED')
  }
}

const indexDocuments = (operational, collection) => new Map(
  operational.getLoadedDocuments(collection).map((document) => [legacyIdOf(document._id) || document.legacyId, document])
)
const sourceRef = (posting, collection) => posting.sourceRefs.find((ref) => ref.startsWith(`${collection}:`))?.split(':')[1] || null

const collectTargetSnapshot = async (client, migrationRunId) => {
  const rows = async (sql, params = []) => (await client.query(sql, params)).rows
  return {
    users: await rows(`SELECT u.legacy_mongo_id,u.email_normalized,u.username_normalized,u.display_name,u.status,u.language_code,
      u.currency_code,u.timezone,u.reminder_enabled,u.reminder_local_time::text,u.week_start,u.month_start_day,
      avatar_asset.provider avatar_provider,avatar_asset.source_provenance->>'sourceCollection' avatar_source_collection,
      avatar_asset.source_provenance->>'sourceLegacyId' avatar_source_legacy_id,
      avatar_asset.source_provenance->>'sourcePath' avatar_source_path,
      avatar_asset.source_provenance->>'sourceOrdinal' avatar_source_ordinal,
      avatar_asset.source_provenance->>'urlSha256' avatar_url_sha256,
      avatar_asset.source_provenance->>'classification' avatar_classification
      FROM users u LEFT JOIN attachments avatar_attachment ON avatar_attachment.id=u.avatar_attachment_id
      LEFT JOIN temporary_assets avatar_asset ON avatar_asset.id=avatar_attachment.asset_id ORDER BY u.legacy_mongo_id`),
    spaces: await rows(`SELECT u.legacy_mongo_id owner_legacy_id,s.kind,s.name,s.status,m.role,m.status membership_status
      FROM financial_spaces s JOIN financial_space_memberships m ON m.financial_space_id=s.id AND m.role='OWNER'
      JOIN users u ON u.id=m.user_id ORDER BY u.legacy_mongo_id`),
    banks: await rows('SELECT legacy_mongo_id,code,name,logo_url,is_active FROM banks ORDER BY legacy_mongo_id'),
    categories: await rows(`SELECT c.legacy_mongo_id,u.legacy_mongo_id owner_legacy_id,c.name,c.transaction_type,c.is_system_locked,c.icon
      FROM categories c JOIN financial_space_memberships m ON m.financial_space_id=c.financial_space_id AND m.role='OWNER'
      JOIN users u ON u.id=m.user_id ORDER BY c.legacy_mongo_id`),
    categoryEdges: await rows(`SELECT p.legacy_mongo_id parent_legacy_id,c.legacy_mongo_id child_legacy_id
      FROM category_edges e JOIN categories p ON p.id=e.parent_category_id JOIN categories c ON c.id=e.child_category_id
      ORDER BY p.legacy_mongo_id,c.legacy_mongo_id`),
    accounts: await rows(`SELECT a.legacy_mongo_id,u.legacy_mongo_id owner_legacy_id,b.legacy_mongo_id bank_legacy_id,a.type,a.name,
      a.description,a.icon,a.status,a.legacy_initial_balance::text,a.legacy_stored_balance::text FROM accounts a
      JOIN financial_space_memberships m ON m.financial_space_id=a.financial_space_id AND m.role='OWNER' JOIN users u ON u.id=m.user_id
      LEFT JOIN banks b ON b.id=a.bank_id ORDER BY a.legacy_mongo_id`),
    accumulations: await rows(`SELECT a.legacy_mongo_id,u.legacy_mongo_id owner_legacy_id,a.name,a.description,a.target_amount::text,
      a.legacy_stored_balance::text,a.starts_at::text,a.ends_at::text,a.status FROM accumulations a
      JOIN financial_space_memberships m ON m.financial_space_id=a.financial_space_id AND m.role='OWNER' JOIN users u ON u.id=m.user_id
      ORDER BY a.legacy_mongo_id`),
    contacts: await rows(`SELECT c.legacy_mongo_id,u.legacy_mongo_id owner_legacy_id,c.name,c.trust_level FROM contacts c
      JOIN financial_space_memberships m ON m.financial_space_id=c.financial_space_id AND m.role='OWNER' JOIN users u ON u.id=m.user_id
      ORDER BY c.legacy_mongo_id`),
    ledgers: await rows(`SELECT u.legacy_mongo_id owner_legacy_id,l.kind,l.normal_side,l.system_role,a.legacy_mongo_id account_legacy_id,
      g.legacy_mongo_id accumulation_legacy_id,l.current_balance::text,l.current_sequence::text,l.allows_negative_balance,l.status
      FROM ledger_accounts l JOIN financial_space_memberships m ON m.financial_space_id=l.financial_space_id AND m.role='OWNER'
      JOIN users u ON u.id=m.user_id LEFT JOIN accounts a ON a.id=l.account_id LEFT JOIN accumulations g ON g.id=l.accumulation_id
      ORDER BY u.legacy_mongo_id,l.kind,l.system_role,a.legacy_mongo_id,g.legacy_mongo_id`),
    transactions: await rows(`SELECT coalesce(t.legacy_mongo_id,t.business_snapshot->'sourceRefs'->>0) source_key,p.code template_code,
      t.type,t.status,u.legacy_mongo_id responsible_legacy_id,c.legacy_mongo_id category_legacy_id,t.name,t.description,t.amount::text,
      t.occurred_at::text,t.business_snapshot FROM financial_transactions t JOIN posting_template_definitions p ON p.id=t.posting_template_definition_id
      JOIN users u ON u.id=t.responsible_user_id LEFT JOIN categories c ON c.id=t.category_id ORDER BY source_key,p.code`),
    entries: await rows(`SELECT coalesce(t.legacy_mongo_id,t.business_snapshot->'sourceRefs'->>0) transaction_key,
      coalesce(a.legacy_mongo_id,g.legacy_mongo_id,l.system_role) ledger_key,e.account_sequence::text,e.amount::text,
      e.balance_before::text,e.balance_after::text,e.entry_role FROM ledger_entries e
      JOIN financial_transactions t ON t.id=e.financial_transaction_id JOIN ledger_accounts l ON l.id=e.ledger_account_id
      LEFT JOIN accounts a ON a.id=l.account_id LEFT JOIN accumulations g ON g.id=l.accumulation_id
      ORDER BY transaction_key,ledger_key,e.account_sequence`),
    incomeDetails: await rows(`SELECT d.legacy_mongo_id,t.legacy_mongo_id transaction_legacy_id,coalesce(a.legacy_mongo_id,g.legacy_mongo_id) ledger_legacy_id
      FROM transaction_income_details d JOIN financial_transactions t ON t.id=d.financial_transaction_id
      JOIN ledger_accounts l ON l.id=d.target_ledger_account_id LEFT JOIN accounts a ON a.id=l.account_id
      LEFT JOIN accumulations g ON g.id=l.accumulation_id ORDER BY d.legacy_mongo_id`),
    expenseDetails: await rows(`SELECT d.legacy_mongo_id,t.legacy_mongo_id transaction_legacy_id,coalesce(a.legacy_mongo_id,g.legacy_mongo_id) ledger_legacy_id
      FROM transaction_expense_details d JOIN financial_transactions t ON t.id=d.financial_transaction_id
      JOIN ledger_accounts l ON l.id=d.source_ledger_account_id LEFT JOIN accounts a ON a.id=l.account_id
      LEFT JOIN accumulations g ON g.id=l.accumulation_id ORDER BY d.legacy_mongo_id`),
    debts: await rows(`SELECT d.legacy_mongo_id,t.legacy_mongo_id transaction_legacy_id,c.legacy_mongo_id contact_legacy_id,d.direction,
      d.principal_amount::text,d.rate_value::text,d.rate_basis,d.due_at::text,d.trust_level,d.status,d.outstanding_principal::text,
      d.outstanding_interest::text FROM debt_agreements d JOIN financial_transactions t ON t.id=d.origin_transaction_id
      JOIN contacts c ON c.id=d.counterparty_contact_id ORDER BY d.legacy_mongo_id`),
    attachments: await rows(`SELECT owner_user.legacy_mongo_id owner_legacy_id,avatar_user.legacy_mongo_id avatar_user_legacy_id,
      transaction.legacy_mongo_id transaction_legacy_id,asset.provider,asset.provider_resource_type,
      encode(digest(asset.secure_url,'sha256'),'hex') secure_url_hash,asset.status asset_status,asset.source_provenance,
      attachment.role,attachment.source_ordinal,attachment.status attachment_status
      FROM attachments attachment JOIN temporary_assets asset ON asset.id=attachment.asset_id
      JOIN users owner_user ON owner_user.id=asset.owner_user_id
      LEFT JOIN users avatar_user ON avatar_user.id=attachment.user_avatar_user_id
      LEFT JOIN financial_transactions transaction ON transaction.id=attachment.financial_transaction_id
      ORDER BY asset.source_provenance->>'sourceCollection',asset.source_provenance->>'sourceLegacyId',attachment.source_ordinal`),
    budgets: await rows(`SELECT b.legacy_mongo_id,c.legacy_mongo_id category_legacy_id,b.starts_at::text,b.ends_at::text,
      a.source_ordinal,a.category_name_snapshot,a.icon_snapshot,a.amount::text,a.repeat_enabled,a.source_ref
      FROM budgets b JOIN budget_allocations a ON a.budget_id=b.id JOIN categories c ON c.id=a.category_id
      ORDER BY b.legacy_mongo_id,a.source_ordinal`),
    notifications: await rows('SELECT legacy_mongo_id,type,title,message,link FROM notifications ORDER BY legacy_mongo_id'),
    recipients: await rows(`SELECT r.legacy_mongo_id,u.legacy_mongo_id user_legacy_id,n.legacy_mongo_id notification_legacy_id,
      r.is_read,r.received_at::text,r.read_at::text FROM user_notifications r JOIN users u ON u.id=r.user_id
      JOIN notifications n ON n.id=r.notification_id ORDER BY r.legacy_mongo_id`),
    provenance: await rows(`SELECT source_collection,source_legacy_id,source_hash,sanitized_document_hash,
      sanitization_policy_version,redaction_manifest,disposition,target_type FROM migration_source_records
      WHERE migration_run_id=$1 ORDER BY source_collection,source_legacy_id`, [migrationRunId]),
    checkpoints: await rows(`SELECT graph_level,source_collection,status,processed_count::text,loaded_count::text,
      rejected_count::text,canonical_hash FROM migration_checkpoints WHERE migration_run_id=$1 ORDER BY graph_level,source_collection`, [migrationRunId])
  }
}

const queryReconciliation = async (client) => (await client.query(`SELECT
  (SELECT count(*)::int FROM (SELECT financial_transaction_id FROM ledger_entries GROUP BY financial_transaction_id HAVING sum(amount)<>0) q) unbalanced,
  (SELECT count(*)::int FROM ledger_accounts a LEFT JOIN LATERAL
    (SELECT coalesce(sum(amount),0)::bigint balance,coalesce(max(account_sequence),0)::bigint sequence,count(*)::bigint entries
     FROM ledger_entries e WHERE e.ledger_account_id=a.id) p ON true
   WHERE a.current_balance<>p.balance OR a.current_sequence<>p.sequence OR p.sequence<>p.entries) projection_mismatch,
  (SELECT count(*)::int FROM ledger_accounts l LEFT JOIN accounts a ON a.id=l.account_id
   LEFT JOIN accumulations g ON g.id=l.accumulation_id
   WHERE (a.id IS NOT NULL OR g.id IS NOT NULL) AND l.current_balance<>coalesce(a.legacy_stored_balance,g.legacy_stored_balance)) balance_mismatch`)).rows[0]

const assertAvatarAttachmentLink = (targetSnapshot) => {
  const linkedUsers = targetSnapshot.users.filter((user) => user.avatar_source_collection !== null)
  if (linkedUsers.length !== 1) throw new Error('AVATAR_ATTACHMENT_RECIPROCAL_DRIFT')
  const user = linkedUsers[0]
  const validProvenance = user.avatar_provider === 'LEGACY_EXTERNAL' && user.avatar_source_collection === 'users' &&
    user.avatar_source_legacy_id === user.legacy_mongo_id && user.avatar_source_path === 'avatar' &&
    user.avatar_source_ordinal === '0' && /^[a-f0-9]{64}$/.test(user.avatar_url_sha256 || '') &&
    user.avatar_classification === 'LEGACY_EXTERNAL_REQUIRES_REVIEW'
  const reciprocal = targetSnapshot.attachments.find((attachment) =>
    attachment.avatar_user_legacy_id === user.legacy_mongo_id && attachment.provider === 'LEGACY_EXTERNAL' &&
    attachment.role === 'AVATAR' && attachment.source_ordinal === 0 &&
    attachment.source_provenance?.sourceCollection === 'users' &&
    attachment.source_provenance?.sourceLegacyId === user.legacy_mongo_id &&
    attachment.source_provenance?.sourcePath === 'avatar' &&
    attachment.source_provenance?.sourceOrdinal === 0 &&
    attachment.source_provenance?.urlSha256 === user.avatar_url_sha256 &&
    attachment.source_provenance?.classification === 'LEGACY_EXTERNAL_REQUIRES_REVIEW')
  if (!validProvenance || !reciprocal) throw new Error('AVATAR_ATTACHMENT_RECIPROCAL_DRIFT')
}

const verifyExistingRun = async (client, existing) => {
  const targetSnapshot = await collectTargetSnapshot(client, existing.id)
  assertAvatarAttachmentLink(targetSnapshot)
  const targetHash = sha256(canonicalJson(targetSnapshot))
  const dispositionCounts = Object.fromEntries(targetSnapshot.provenance.reduce((counts, row) => {
    counts.set(row.disposition, (counts.get(row.disposition) || 0) + 1)
    return counts
  }, new Map()))
  const missingTarget = await client.query(`SELECT 1 FROM migration_source_records WHERE migration_run_id=$1
    AND disposition='LOADED' AND (target_type IS NULL OR target_public_id IS NULL) LIMIT 1`, [existing.id])
  const reconciliation = await queryReconciliation(client)
  const valid = targetHash === existing.summary.targetHash && targetSnapshot.provenance.length === EXPECTED_COUNTS.source &&
    dispositionCounts.LOADED === EXPECTED_COUNTS.loaded && dispositionCounts.ARCHIVED === EXPECTED_COUNTS.archived &&
    !dispositionCounts.STAGED && !dispositionCounts.REJECTED && !missingTarget.rowCount &&
    targetSnapshot.checkpoints.length === 26 && targetSnapshot.checkpoints.every((checkpoint) => checkpoint.status === 'COMPLETED') &&
    targetSnapshot.transactions.length === EXPECTED_COUNTS.postings && targetSnapshot.entries.length === EXPECTED_COUNTS.entries &&
    targetSnapshot.attachments.length === 3 && targetSnapshot.recipients.length === 134 &&
    !reconciliation.unbalanced && !reconciliation.projection_mismatch && !reconciliation.balance_mismatch
  if (!valid) throw new Error('IDEMPOTENT_REPLAY_EVIDENCE_DRIFT')
  return { ...existing.summary, idempotentReplay: true }
}

const loadWave2Export = async ({
  client, connectionString, markerToken, sanitizedSnapshot, transformPlan, identitySpacePlan, testcontainerCapability
}) => {
  if (!testcontainerCapability || !runnerOwnedCapabilities.has(testcontainerCapability)) {
    throw new Error('TESTCONTAINER_CAPABILITY_REQUIRED')
  }
  await assertDisposableDatabase(client, connectionString, markerToken)
  const summary = transformPlan.summary
  if (summary.sourceCount !== EXPECTED_COUNTS.source || summary.loadedCount !== EXPECTED_COUNTS.loaded ||
      summary.archivedCount !== EXPECTED_COUNTS.archived || summary.rejectedCount !== 0 ||
      summary.blockingCount !== 0 || summary.unclassifiedCount !== 0 ||
      summary.postingCount !== EXPECTED_COUNTS.postings || summary.postingEntryCount !== EXPECTED_COUNTS.entries ||
      summary.balanceHolderCount !== 6 || summary.balanceMismatchCount !== 0) {
    throw new Error('EXPORT_ACCEPTANCE_METRICS_FAILED')
  }
  if ([...new Set(transformPlan.canonicalPlan.postings.map((posting) => posting.templateCode))]
    .some((code) => !SUPPORTED_TRANSACTION_TEMPLATES.has(code))) {
    throw new Error('BLOCKING_UNSUPPORTED_POSTING_TEMPLATE')
  }
  const evidence = materializeSanitizedEvidence(sanitizedSnapshot)
  const sourceChecksum = evidence.manifest.evidenceFingerprint
  const existing = await client.query(`SELECT id,status,summary FROM migration_runs
    WHERE source_snapshot_id=$1 AND source_checksum=$2 AND mapping_version=$3 AND schema_version=$4 AND run_type='DRY_RUN'`,
  [evidence.manifest.sourceSnapshotId, sourceChecksum, MAPPING_VERSION, SCHEMA_VERSION])
  if (existing.rowCount) {
    if (existing.rows[0].status !== 'COMPLETED') throw new Error('INCOMPLETE_EXPORT_LOAD_EXISTS')
    return verifyExistingRun(client, existing.rows[0])
  }

  const nonEmpty = await client.query(`SELECT
    (SELECT count(*) FROM users)+(SELECT count(*) FROM financial_spaces)+(SELECT count(*) FROM banks)+
    (SELECT count(*) FROM categories)+(SELECT count(*) FROM accounts)+(SELECT count(*) FROM accumulations)+
    (SELECT count(*) FROM contacts)+(SELECT count(*) FROM financial_transactions)+
    (SELECT count(*) FROM notifications)+(SELECT count(*) FROM migration_runs) count`)
  if (Number(nonEmpty.rows[0].count) !== 0) throw new Error('CLEAN_DISPOSABLE_DATABASE_REQUIRED')

  await client.query('BEGIN')
  try {
    const migrationRun = (await client.query(`INSERT INTO migration_runs
      (run_type,source_snapshot_id,source_checksum,mapping_version,schema_version,status,started_at,source_count)
      VALUES ('DRY_RUN',$1,$2,$3,$4,'RUNNING',clock_timestamp(),$5) RETURNING id,public_id`,
    [evidence.manifest.sourceSnapshotId, sourceChecksum, MAPPING_VERSION, SCHEMA_VERSION, summary.sourceCount])).rows[0]
    const staged = new Map()
    for (const collection of DECLARED_COLLECTIONS) {
      for (const record of evidence.evidenceByCollection.get(collection)) {
        const row = (await client.query(`INSERT INTO migration_source_records
          (migration_run_id,source_collection,source_legacy_id,source_hash,raw_document,sanitized_document_hash,
           sanitization_policy_version,redaction_manifest)
          VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8::jsonb) RETURNING id`, [
          migrationRun.id, collection, record.sourceLegacyId, record.sourceHash, json(record.sanitizedDocument),
          record.sanitizedDocumentHash, record.policyVersion, json(record.redactions)
        ])).rows[0]
        staged.set(`${collection}:${record.sourceLegacyId}`, row.id)
      }
    }
    const markLoaded = async (collection, legacyId, targetType, publicId) => {
      if (!publicId || !staged.has(`${collection}:${legacyId}`)) throw new Error(`BLOCKING_TARGET_MAPPING_MISSING ${collection}:${legacyId}`)
      await client.query(`UPDATE migration_source_records SET disposition='LOADED',target_type=$1,target_public_id=$2,
        processed_at=clock_timestamp() WHERE id=$3`, [targetType, publicId, staged.get(`${collection}:${legacyId}`)])
    }
    const operational = transformPlan.getOperationalTargetPlan()
    const docs = Object.fromEntries(DECLARED_COLLECTIONS.map((collection) => [collection, indexDocuments(operational, collection)]))
    const users = new Map(), spaces = new Map(), banks = new Map(), categories = new Map()
    const accounts = new Map(), accumulations = new Map(), contacts = new Map()
    const attachmentSpecs = []

    for (const descriptor of identitySpacePlan.users) {
      const source = docs.users.get(descriptor.legacyId)
      const reminderDate = new Date(source.remindTime)
      const reminderTime = Number.isNaN(reminderDate.getTime()) ? null : new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
      }).format(reminderDate)
      const target = (await client.query(`INSERT INTO users
        (legacy_mongo_id,email,email_normalized,password_hash,username,username_normalized,display_name,status,
         language_code,currency_code,timezone,reminder_enabled,reminder_local_time,week_start,month_start_day,
         created_at,updated_at,deleted_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'vi','VND','Asia/Ho_Chi_Minh',$9,$10,$11,$12,$13,$14,$15)
        RETURNING id,public_id`, [descriptor.legacyId, normalizeText(source.email), normalizedKey(source.email), source.password,
        normalizeText(source.username), normalizedKey(source.username), normalizeText(source.displayName),
        source._destroy ? 'DELETED' : source.isActive ? 'ACTIVE' : 'INACTIVE', source.remindToInput === true,
        reminderTime, String(source.startDayOfWeek || 'MONDAY').toUpperCase(), numberOf(source.startDayOfMonth),
        instantOf(source.createdAt), nullableInstantOf(source.updatedAt), source._destroy ? nullableInstantOf(source.updatedAt) || instantOf(source.createdAt) : null])).rows[0]
      users.set(descriptor.legacyId, target)
      await markLoaded('users', descriptor.legacyId, 'User', target.public_id)
      const space = (await client.query(`INSERT INTO financial_spaces (kind,name,status,created_at)
        VALUES ('PERSONAL',$1,'ACTIVE',$2) RETURNING id,public_id`, [normalizeText(source.displayName), instantOf(source.createdAt)])).rows[0]
      spaces.set(`individual:${descriptor.legacyId}`, space)
      await client.query(`INSERT INTO financial_space_memberships
        (financial_space_id,user_id,role,status,joined_at,source_ref)
        VALUES ($1,$2,'OWNER','ACTIVE',$3,$4::jsonb)`, [space.id, target.id, instantOf(source.createdAt), json({ source: 'users', legacyId: descriptor.legacyId })])
      if (typeof source.avatar === 'string' && source.avatar.trim()) {
        attachmentSpecs.push({
          sourceCollection: 'users', sourceLegacyId: descriptor.legacyId, sourcePath: 'avatar', ordinal: 0,
          secureUrl: source.avatar.trim(), ownerUserId: target.id, financialSpaceId: null,
          userAvatarUserId: target.id, financialTransactionId: null, role: 'AVATAR', createdAt: instantOf(source.createdAt)
        })
      }
    }

    for (const [legacyId, source] of docs.banks) {
      const target = (await client.query(`INSERT INTO banks
        (legacy_mongo_id,code,name,logo_url,is_active,created_at,updated_at,deleted_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,public_id`, [legacyId, normalizeText(source.code).toUpperCase(),
        normalizeText(source.name), source.logo || null, !source._destroy, instantOf(source.createdAt),
        nullableInstantOf(source.updatedAt), source._destroy ? nullableInstantOf(source.updatedAt) || instantOf(source.createdAt) : null])).rows[0]
      banks.set(legacyId, target); await markLoaded('banks', legacyId, 'Bank', target.public_id)
    }

    const resolveSpace = (collection, legacyId, source) => {
      const ownerId = legacyIdOf(source.ownerId)
      const space = source.ownerType === 'individual' ? spaces.get(`individual:${ownerId}`) : null
      if (!space) throw new Error(`BLOCKING_OWNER_RESOLUTION ${collection}:${legacyId}`)
      return space
    }
    for (const [legacyId, source] of docs.categories) {
      const space = resolveSpace('categories', legacyId, source)
      const target = (await client.query(`INSERT INTO categories
        (legacy_mongo_id,financial_space_id,name,transaction_type,is_system_locked,icon,created_at,updated_at,deleted_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,public_id`, [legacyId, space.id, normalizeText(source.name),
        String(source.type).toUpperCase(), source.allowDelete === false, source.icon || null, instantOf(source.createdAt),
        nullableInstantOf(source.updatedAt), source._destroy ? nullableInstantOf(source.updatedAt) || instantOf(source.createdAt) : null])).rows[0]
      categories.set(legacyId, { ...target, spaceId: space.id }); await markLoaded('categories', legacyId, 'Category', target.public_id)
    }
    const edgeKeys = new Set()
    for (const [legacyId, source] of docs.categories) {
      const edges = [
        ...(source.childrenIds || []).map((child) => [legacyId, legacyIdOf(child)]),
        ...(source.parentIds || []).map((parent) => [legacyIdOf(parent), legacyId])
      ]
      for (const [parentLegacyId, childLegacyId] of edges) {
        const key = `${parentLegacyId}:${childLegacyId}`
        if (edgeKeys.has(key)) continue
        const parent = categories.get(parentLegacyId), child = categories.get(childLegacyId)
        if (!parent || !child || String(parent.spaceId) !== String(child.spaceId)) throw new Error(`BLOCKING_CATEGORY_EDGE ${key}`)
        await client.query(`INSERT INTO category_edges
          (financial_space_id,parent_category_id,child_category_id,source_ref)
          VALUES ($1,$2,$3,$4::jsonb)`, [parent.spaceId, parent.id, child.id, json({ source: 'categories', parentLegacyId, childLegacyId })])
        edgeKeys.add(key)
      }
    }

    const accountType = (value) => ({ wallet: 'WALLET', cash: 'WALLET', bank: 'BANK', other: 'OTHER', orther: 'OTHER' })[String(value).toLowerCase()]
    for (const [legacyId, source] of docs.accounts) {
      const space = resolveSpace('accounts', legacyId, source), type = accountType(source.type)
      if (!type) throw new Error(`BLOCKING_ACCOUNT_TYPE ${legacyId}`)
      const bankId = source.bankId ? banks.get(legacyIdOf(source.bankId))?.id : null
      if (source.bankId && !bankId) throw new Error(`BLOCKING_BANK_REFERENCE accounts:${legacyId}`)
      const target = (await client.query(`INSERT INTO accounts
        (legacy_mongo_id,financial_space_id,bank_id,type,name,description,icon,status,legacy_initial_balance,
         legacy_stored_balance,created_at,updated_at,deleted_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id,public_id`, [legacyId, space.id, bankId, type,
        normalizeText(source.accountName), source.description || null, source.icon || null,
        source._destroy ? 'ARCHIVED' : source.isBlock ? 'BLOCKED' : 'ACTIVE', numberOf(source.initBalance), numberOf(source.balance),
        instantOf(source.createdAt), nullableInstantOf(source.updatedAt), source._destroy ? nullableInstantOf(source.updatedAt) || instantOf(source.createdAt) : null])).rows[0]
      accounts.set(legacyId, { ...target, spaceId: space.id, name: normalizeText(source.accountName) })
      await markLoaded('accounts', legacyId, 'Account', target.public_id)
    }
    for (const [legacyId, source] of docs.accumulations) {
      const space = resolveSpace('accumulations', legacyId, source)
      const target = (await client.query(`INSERT INTO accumulations
        (legacy_mongo_id,financial_space_id,name,description,target_amount,legacy_stored_balance,starts_at,ends_at,
         status,finished_at,created_at,updated_at,deleted_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id,public_id`, [legacyId, space.id,
        normalizeText(source.accumulationName), source.description || null, numberOf(source.targetBalance), numberOf(source.balance),
        instantOf(source.startDate), instantOf(source.endDate), source._destroy ? 'ARCHIVED' : source.isFinish ? 'FINISHED' : 'ACTIVE',
        source.isFinish ? nullableInstantOf(source.updatedAt) || instantOf(source.endDate) : null, instantOf(source.createdAt),
        nullableInstantOf(source.updatedAt), source._destroy ? nullableInstantOf(source.updatedAt) || instantOf(source.createdAt) : null])).rows[0]
      accumulations.set(legacyId, { ...target, spaceId: space.id, name: normalizeText(source.accumulationName) })
      await markLoaded('accumulations', legacyId, 'Accumulation', target.public_id)
    }
    for (const [legacyId, source] of docs.contacts) {
      const space = resolveSpace('contacts', legacyId, source)
      const trust = String(source.trustLevel || 'NORMAL').toUpperCase()
      if (!['NORMAL', 'GOOD', 'WARNING', 'BAD'].includes(trust)) throw new Error(`BLOCKING_TRUST_LEVEL contacts:${legacyId}`)
      const target = (await client.query(`INSERT INTO contacts
        (legacy_mongo_id,financial_space_id,name,trust_level,created_at,updated_at,deleted_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,public_id`, [legacyId, space.id, normalizeText(source.name), trust,
        instantOf(source.createdAt), nullableInstantOf(source.updatedAt), source._destroy ? nullableInstantOf(source.updatedAt) || instantOf(source.createdAt) : null])).rows[0]
      contacts.set(legacyId, { ...target, spaceId: space.id }); await markLoaded('contacts', legacyId, 'Contact', target.public_id)
    }

    const ledgerByRef = new Map()
    for (const [legacyId, account] of accounts) {
      const target = (await client.query(`INSERT INTO ledger_accounts
        (financial_space_id,kind,normal_side,account_id,name,current_balance,current_sequence,allows_negative_balance,status)
        VALUES ($1,'USER_BALANCE','DEBIT',$2,$3,0,0,false,'ACTIVE') RETURNING id,public_id`,
      [account.spaceId, account.id, account.name])).rows[0]
      const ownerLegacyId = [...spaces].find(([, space]) => String(space.id) === String(account.spaceId))?.[0]?.split(':')[1]
      ledgerByRef.set(`individual:${ownerLegacyId}|holder:account:${legacyId}`, target)
    }
    for (const [legacyId, accumulation] of accumulations) {
      const target = (await client.query(`INSERT INTO ledger_accounts
        (financial_space_id,kind,normal_side,accumulation_id,name,current_balance,current_sequence,allows_negative_balance,status)
        VALUES ($1,'USER_BALANCE','DEBIT',$2,$3,0,0,false,'ACTIVE') RETURNING id,public_id`,
      [accumulation.spaceId, accumulation.id, accumulation.name])).rows[0]
      const ownerLegacyId = [...spaces].find(([, space]) => String(space.id) === String(accumulation.spaceId))?.[0]?.split(':')[1]
      ledgerByRef.set(`individual:${ownerLegacyId}|holder:accumulation:${legacyId}`, target)
    }
    const systemDefinitions = (await client.query(`SELECT code,normal_side,allows_negative_balance
      FROM system_account_definitions ORDER BY code`)).rows
    for (const [spaceRef, space] of spaces) {
      for (const definition of systemDefinitions) {
        const target = (await client.query(`INSERT INTO ledger_accounts
          (financial_space_id,kind,normal_side,system_role,name,current_balance,current_sequence,allows_negative_balance,status)
          VALUES ($1,'SYSTEM',$2,$3,$3,0,0,$4,'ACTIVE') RETURNING id,public_id`,
        [space.id, definition.normal_side, definition.code, definition.allows_negative_balance])).rows[0]
        ledgerByRef.set(`${spaceRef}|system:${definition.code}`, target)
      }
    }

    const templates = new Map((await client.query('SELECT id,code,version FROM posting_template_definitions WHERE status=\'APPROVED\''))
      .rows.map((row) => [row.code, row]))
    const transactionTargets = new Map()
    for (const posting of transformPlan.canonicalPlan.postings) {
      const transactionLegacyId = sourceRef(posting, 'transactions')
      const sourceTransaction = transactionLegacyId ? docs.transactions.get(transactionLegacyId) : null
      const space = spaces.get(posting.entries[0]?.space)
      if (!space || !templates.has(posting.templateCode)) throw new Error(`BLOCKING_POSTING_MAPPING ${posting.templateCode}:${posting.legacyId}`)
      const responsibleLegacyId = sourceTransaction ? legacyIdOf(sourceTransaction.responsiblePersonId) : posting.entries[0].space.split(':')[1]
      const responsible = users.get(responsibleLegacyId)
      const category = sourceTransaction?.categoryId ? categories.get(legacyIdOf(sourceTransaction.categoryId)) : null
      if (!responsible || (sourceTransaction?.categoryId && !category)) throw new Error(`BLOCKING_TRANSACTION_REFERENCE ${posting.legacyId}`)
      const businessSnapshot = {
        source: 'wave2-export', sourceRefs: posting.sourceRefs, templateVersion: posting.templateVersion,
        transformPlanHash: transformPlan.canonicalPlan.planHash, metadata: posting.metadata
      }
      const target = (await client.query(`INSERT INTO financial_transactions
        (legacy_mongo_id,financial_space_id,posting_template_definition_id,type,status,responsible_user_id,category_id,
         name,description,amount,occurred_at,business_snapshot,snapshot_schema_version,correlation_id,created_at)
        VALUES ($1,$2,$3,$4,'DRAFT',$5,$6,$7,$8,$9,$10,$11::jsonb,1,$12,$10) RETURNING id,public_id`, [
        transactionLegacyId, space.id, templates.get(posting.templateCode).id, posting.transactionType, responsible.id,
        category?.id || null, sourceTransaction ? normalizeText(sourceTransaction.name) : `Migration opening ${posting.legacyId}`,
        sourceTransaction?.description || null, posting.amount, posting.occurredAt, json(businessSnapshot), randomUUID()
      ])).rows[0]
      for (const entry of posting.entries) {
        const ledger = ledgerByRef.get(entry.ledgerRef)
        if (!ledger) throw new Error(`BLOCKING_LEDGER_MAPPING ${entry.ledgerRef}`)
        await client.query(`INSERT INTO ledger_entries
          (financial_transaction_id,ledger_account_id,account_sequence,amount,balance_before,balance_after,posted_at,entry_role)
          VALUES ($1,$2,$3,$4,$5,$6,transaction_timestamp(),$7)`, [target.id, ledger.id, entry.sequence, entry.amount,
          entry.balanceBefore, entry.balanceAfter, entry.entryRole])
      }

      if (transactionLegacyId) {
        transactionTargets.set(transactionLegacyId, target)
        await markLoaded('transactions', transactionLegacyId, 'FinancialTransaction', target.public_id)
      }
      if (posting.templateCode === 'INCOME') {
        const detailLegacyId = sourceRef(posting, 'incomes'), entry = posting.entries.find((item) => item.entryRole === 'TARGET')
        const ledger = ledgerByRef.get(entry?.ledgerRef)
        const detail = (await client.query(`INSERT INTO transaction_income_details
          (legacy_mongo_id,financial_transaction_id,target_ledger_account_id)
          VALUES ($1,$2,$3) RETURNING public_id`, [detailLegacyId, target.id, ledger?.id])).rows[0]
        await markLoaded('incomes', detailLegacyId, 'TransactionIncomeDetail', detail.public_id)
      }
      if (posting.templateCode === 'EXPENSE') {
        const detailLegacyId = sourceRef(posting, 'expenses'), entry = posting.entries.find((item) => item.entryRole === 'SOURCE')
        const ledger = ledgerByRef.get(entry?.ledgerRef)
        const detail = (await client.query(`INSERT INTO transaction_expense_details
          (legacy_mongo_id,financial_transaction_id,source_ledger_account_id)
          VALUES ($1,$2,$3) RETURNING public_id`, [detailLegacyId, target.id, ledger?.id])).rows[0]
        await markLoaded('expenses', detailLegacyId, 'TransactionExpenseDetail', detail.public_id)
        const detailSource = docs.expenses.get(detailLegacyId)
        for (const [ordinal, secureUrl] of (detailSource.images || []).entries()) {
          attachmentSpecs.push({
            sourceCollection: 'expenses', sourceLegacyId: detailLegacyId, sourcePath: 'images', ordinal,
            secureUrl, ownerUserId: responsible.id, financialSpaceId: space.id, userAvatarUserId: null,
            financialTransactionId: target.id, role: 'EVIDENCE_IMAGE', createdAt: instantOf(detailSource.createdAt)
          })
        }
      }
      if (posting.templateCode === 'LOAN_DISBURSEMENT') {
        const metadata = posting.metadata, detailLegacyId = sourceRef(posting, 'loans')
        const source = docs.loans.get(detailLegacyId), contact = contacts.get(metadata.contactLegacyId)
        const cash = ledgerByRef.get(posting.entries.find((entry) => entry.entryRole === 'CASH_SOURCE')?.ledgerRef)
        const debt = ledgerByRef.get(posting.entries.find((entry) => entry.entryRole === 'LOAN_RECEIVABLE')?.ledgerRef)
        if (!source || !contact || !cash || !debt) throw new Error(`BLOCKING_DEBT_MAPPING ${detailLegacyId}`)
        const trust = String(source.trustLevel || 'NORMAL').toUpperCase()
        const agreement = (await client.query(`INSERT INTO debt_agreements
          (legacy_mongo_id,financial_space_id,origin_transaction_id,direction,cash_ledger_account_id,debt_ledger_account_id,
           counterparty_contact_id,principal_amount,rate_value,fixed_interest_amount,rate_basis,due_at,trust_level,status,
           outstanding_principal,outstanding_interest,created_at)
          VALUES ($1,$2,$3,'RECEIVABLE',$4,$5,$6,$7,$8,NULL,$9,$10,$11,'OPEN',$7,0,$12) RETURNING public_id`, [
          detailLegacyId, space.id, target.id, cash.id, debt.id, contact.id, metadata.principalAmount,
          metadata.rate, metadata.rateBasis, nullableInstantOf(source.collectTime), trust, instantOf(source.createdAt)
        ])).rows[0]
        await markLoaded('loans', detailLegacyId, 'DebtAgreement', agreement.public_id)
        for (const [ordinal, secureUrl] of (source.images || []).entries()) {
          attachmentSpecs.push({
            sourceCollection: 'loans', sourceLegacyId: detailLegacyId, sourcePath: 'images', ordinal,
            secureUrl, ownerUserId: responsible.id, financialSpaceId: space.id, userAvatarUserId: null,
            financialTransactionId: target.id, role: 'EVIDENCE_IMAGE', createdAt: instantOf(source.createdAt)
          })
        }
      }
      await client.query('UPDATE financial_transactions SET status=\'POSTED\',updated_at=clock_timestamp() WHERE id=$1', [target.id])
    }

    let attachmentCount = 0
    for (const spec of attachmentSpecs) {
      let parsedUrl
      try { parsedUrl = new URL(spec.secureUrl) } catch { throw new Error(`BLOCKING_LEGACY_ASSET_URL ${spec.sourceCollection}:${spec.sourceLegacyId}`) }
      if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password) {
        throw new Error(`BLOCKING_LEGACY_ASSET_URL ${spec.sourceCollection}:${spec.sourceLegacyId}`)
      }
      const provenance = {
        sourceCollection: spec.sourceCollection, sourceLegacyId: spec.sourceLegacyId,
        sourcePath: spec.sourcePath, sourceOrdinal: spec.ordinal, urlSha256: sha256(spec.secureUrl),
        classification: 'LEGACY_EXTERNAL_REQUIRES_REVIEW'
      }
      const asset = (await client.query(`INSERT INTO temporary_assets
        (owner_user_id,financial_space_id,upload_session_id,provider,provider_resource_type,secure_url,status,
         source_provenance,created_at,updated_at)
        VALUES ($1,$2,$3,'LEGACY_EXTERNAL','image',$4,'REQUIRES_REVIEW',$5::jsonb,$6,$6) RETURNING id`, [
        spec.ownerUserId, spec.financialSpaceId, randomUUID(), spec.secureUrl, json(provenance), spec.createdAt
      ])).rows[0]
      const attachment = (await client.query(`INSERT INTO attachments
        (asset_id,financial_space_id,user_avatar_user_id,financial_transaction_id,role,source_ordinal,status,
         linked_by_user_id,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,'REQUIRES_REVIEW',$7,$8,$8) RETURNING id`, [asset.id, spec.financialSpaceId,
        spec.userAvatarUserId, spec.financialTransactionId, spec.role, spec.ordinal, spec.ownerUserId, spec.createdAt])).rows[0]
      if (spec.userAvatarUserId) {
        await client.query('UPDATE users SET avatar_attachment_id=$1 WHERE id=$2', [attachment.id, spec.userAvatarUserId])
      }
      attachmentCount += 1
    }

    for (const [legacyId, budget] of docs.budgets) {
      const space = spaces.get(budget.space)
      if (!space) throw new Error(`BLOCKING_BUDGET_SPACE ${legacyId}`)
      const target = (await client.query(`INSERT INTO budgets
        (legacy_mongo_id,financial_space_id,starts_at,ends_at,status)
        VALUES ($1,$2,$3,$4,'ACTIVE') RETURNING id,public_id`, [legacyId, space.id, budget.startAt, budget.endAt])).rows[0]
      for (const [ordinal, allocation] of budget.allocations.entries()) {
        const category = categories.get(allocation.categoryLegacyId), categorySource = docs.categories.get(allocation.categoryLegacyId)
        if (!category || String(category.spaceId) !== String(space.id)) throw new Error(`BLOCKING_BUDGET_CATEGORY ${legacyId}`)
        await client.query(`INSERT INTO budget_allocations
          (budget_id,category_id,source_ordinal,category_name_snapshot,icon_snapshot,amount,repeat_enabled,source_ref)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`, [target.id, category.id, ordinal, normalizeText(categorySource.name),
          categorySource.icon || null, allocation.amount, allocation.repeat, json({ transactionLegacyIds: allocation.transactionLegacyIds })])
      }
      await markLoaded('budgets', legacyId, 'Budget', target.public_id)
    }

    const notificationIds = new Map()
    for (const [legacyId, notification] of docs.notifications) {
      const target = (await client.query(`INSERT INTO notifications (legacy_mongo_id,type,title,message,link)
        VALUES ($1,$2,$3,$4,$5) RETURNING id,public_id`, [legacyId, notification.notificationType,
        notification.title, notification.message, notification.link])).rows[0]
      notificationIds.set(legacyId, target); await markLoaded('notifications', legacyId, 'Notification', target.public_id)
    }
    for (const [legacyId, recipient] of docs.user_notifications) {
      const user = users.get(recipient.userLegacyId), notification = notificationIds.get(recipient.notificationLegacyId)
      if (!user || !notification) throw new Error(`BLOCKING_NOTIFICATION_RECIPIENT ${legacyId}`)
      const target = (await client.query(`INSERT INTO user_notifications
        (legacy_mongo_id,user_id,notification_id,is_read,received_at,read_at)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING public_id`, [legacyId, user.id, notification.id, recipient.isRead,
        recipient.receivedAt, recipient.readAt])).rows[0]
      await markLoaded('user_notifications', legacyId, 'UserNotification', target.public_id)
    }

    for (const disposition of transformPlan.canonicalPlan.dispositions.filter((item) => item.disposition === 'ARCHIVED')) {
      await client.query(`UPDATE migration_source_records SET disposition='ARCHIVED',target_type='ARCHIVE_ONLY',
        processed_at=clock_timestamp() WHERE id=$1`, [staged.get(`${disposition.collection}:${disposition.legacyId}`)])
    }
    for (const route of transformPlan.canonicalPlan.routes) {
      const routeHash = sha256(canonicalJson({ route, planHash: transformPlan.canonicalPlan.planHash }))
      const lastLegacyId = [...evidence.evidenceByCollection.get(route.collection)].at(-1)?.sourceLegacyId || null
      const graphLevel = CHECKPOINT_GRAPH_LEVEL[route.collection]
      if (!Number.isInteger(graphLevel)) throw new Error(`BLOCKING_CHECKPOINT_GRAPH_LEVEL ${route.collection}`)
      await client.query(`INSERT INTO migration_checkpoints
        (migration_run_id,graph_level,source_collection,last_source_legacy_id,status,processed_count,loaded_count,
         rejected_count,canonical_hash,started_at,completed_at)
        VALUES ($1,$2,$3,$4,'COMPLETED',$5,$6,$7,$8,clock_timestamp(),clock_timestamp())`, [migrationRun.id,
        graphLevel, route.collection, lastLegacyId, route.sourceCount, route.loadedCount, route.rejectedCount, routeHash])
    }

    const dispositions = (await client.query(`SELECT disposition::text,count(*)::int count FROM migration_source_records
      WHERE migration_run_id=$1 GROUP BY disposition`, [migrationRun.id])).rows
    const dispositionCount = (name) => dispositions.find((row) => row.disposition === name)?.count || 0
    if (dispositionCount('LOADED') !== summary.loadedCount || dispositionCount('ARCHIVED') !== summary.archivedCount ||
        dispositionCount('STAGED') !== 0 || dispositionCount('REJECTED') !== 0) throw new Error('PROVENANCE_DISPOSITION_MISMATCH')
    const missingTarget = await client.query(`SELECT source_collection,source_legacy_id FROM migration_source_records
      WHERE migration_run_id=$1 AND disposition='LOADED' AND (target_type IS NULL OR target_public_id IS NULL) LIMIT 1`, [migrationRun.id])
    if (missingTarget.rowCount) throw new Error('LOADED_TARGET_PROVENANCE_MISSING')

    const reconciliation = (await client.query(`SELECT
      (SELECT count(*)::int FROM (SELECT financial_transaction_id FROM ledger_entries GROUP BY financial_transaction_id HAVING sum(amount)<>0) q) unbalanced,
      (SELECT count(*)::int FROM ledger_accounts a LEFT JOIN LATERAL
        (SELECT coalesce(sum(amount),0)::bigint balance,coalesce(max(account_sequence),0)::bigint sequence,count(*)::bigint entries
         FROM ledger_entries e WHERE e.ledger_account_id=a.id) p ON true
       WHERE a.current_balance<>p.balance OR a.current_sequence<>p.sequence OR p.sequence<>p.entries) projection_mismatch,
      (SELECT count(*)::int FROM ledger_accounts l LEFT JOIN accounts a ON a.id=l.account_id
       LEFT JOIN accumulations g ON g.id=l.accumulation_id
       WHERE (a.id IS NOT NULL OR g.id IS NOT NULL) AND l.current_balance<>coalesce(a.legacy_stored_balance,g.legacy_stored_balance)) balance_mismatch`)).rows[0]
    if (reconciliation.unbalanced || reconciliation.projection_mismatch || reconciliation.balance_mismatch) {
      throw new Error(`LEDGER_RECONCILIATION_FAILED ${json(reconciliation)}`)
    }

    const rows = async (sql, params = []) => (await client.query(sql, params)).rows
    const targetSnapshot = {
      users: await rows(`SELECT u.legacy_mongo_id,u.email_normalized,u.username_normalized,u.display_name,u.status,u.language_code,
        u.currency_code,u.timezone,u.reminder_enabled,u.reminder_local_time::text,u.week_start,u.month_start_day,
        avatar_asset.provider avatar_provider,avatar_asset.source_provenance->>'sourceCollection' avatar_source_collection,
        avatar_asset.source_provenance->>'sourceLegacyId' avatar_source_legacy_id,
        avatar_asset.source_provenance->>'sourcePath' avatar_source_path,
        avatar_asset.source_provenance->>'sourceOrdinal' avatar_source_ordinal,
        avatar_asset.source_provenance->>'urlSha256' avatar_url_sha256,
        avatar_asset.source_provenance->>'classification' avatar_classification
        FROM users u LEFT JOIN attachments avatar_attachment ON avatar_attachment.id=u.avatar_attachment_id
        LEFT JOIN temporary_assets avatar_asset ON avatar_asset.id=avatar_attachment.asset_id ORDER BY u.legacy_mongo_id`),
      spaces: await rows(`SELECT u.legacy_mongo_id owner_legacy_id,s.kind,s.name,s.status,m.role,m.status membership_status
        FROM financial_spaces s JOIN financial_space_memberships m ON m.financial_space_id=s.id AND m.role='OWNER'
        JOIN users u ON u.id=m.user_id ORDER BY u.legacy_mongo_id`),
      banks: await rows('SELECT legacy_mongo_id,code,name,logo_url,is_active FROM banks ORDER BY legacy_mongo_id'),
      categories: await rows(`SELECT c.legacy_mongo_id,u.legacy_mongo_id owner_legacy_id,c.name,c.transaction_type,c.is_system_locked,c.icon
        FROM categories c JOIN financial_space_memberships m ON m.financial_space_id=c.financial_space_id AND m.role='OWNER'
        JOIN users u ON u.id=m.user_id ORDER BY c.legacy_mongo_id`),
      categoryEdges: await rows(`SELECT p.legacy_mongo_id parent_legacy_id,c.legacy_mongo_id child_legacy_id
        FROM category_edges e JOIN categories p ON p.id=e.parent_category_id JOIN categories c ON c.id=e.child_category_id
        ORDER BY p.legacy_mongo_id,c.legacy_mongo_id`),
      accounts: await rows(`SELECT a.legacy_mongo_id,u.legacy_mongo_id owner_legacy_id,b.legacy_mongo_id bank_legacy_id,a.type,a.name,
        a.description,a.icon,a.status,a.legacy_initial_balance::text,a.legacy_stored_balance::text FROM accounts a
        JOIN financial_space_memberships m ON m.financial_space_id=a.financial_space_id AND m.role='OWNER' JOIN users u ON u.id=m.user_id
        LEFT JOIN banks b ON b.id=a.bank_id ORDER BY a.legacy_mongo_id`),
      accumulations: await rows(`SELECT a.legacy_mongo_id,u.legacy_mongo_id owner_legacy_id,a.name,a.description,a.target_amount::text,
        a.legacy_stored_balance::text,a.starts_at::text,a.ends_at::text,a.status FROM accumulations a
        JOIN financial_space_memberships m ON m.financial_space_id=a.financial_space_id AND m.role='OWNER' JOIN users u ON u.id=m.user_id
        ORDER BY a.legacy_mongo_id`),
      contacts: await rows(`SELECT c.legacy_mongo_id,u.legacy_mongo_id owner_legacy_id,c.name,c.trust_level FROM contacts c
        JOIN financial_space_memberships m ON m.financial_space_id=c.financial_space_id AND m.role='OWNER' JOIN users u ON u.id=m.user_id
        ORDER BY c.legacy_mongo_id`),
      ledgers: await rows(`SELECT u.legacy_mongo_id owner_legacy_id,l.kind,l.normal_side,l.system_role,a.legacy_mongo_id account_legacy_id,
        g.legacy_mongo_id accumulation_legacy_id,l.current_balance::text,l.current_sequence::text,l.allows_negative_balance,l.status
        FROM ledger_accounts l JOIN financial_space_memberships m ON m.financial_space_id=l.financial_space_id AND m.role='OWNER'
        JOIN users u ON u.id=m.user_id LEFT JOIN accounts a ON a.id=l.account_id LEFT JOIN accumulations g ON g.id=l.accumulation_id
        ORDER BY u.legacy_mongo_id,l.kind,l.system_role,a.legacy_mongo_id,g.legacy_mongo_id`),
      transactions: await rows(`SELECT coalesce(t.legacy_mongo_id,t.business_snapshot->'sourceRefs'->>0) source_key,p.code template_code,
        t.type,t.status,u.legacy_mongo_id responsible_legacy_id,c.legacy_mongo_id category_legacy_id,t.name,t.description,t.amount::text,
        t.occurred_at::text,t.business_snapshot FROM financial_transactions t JOIN posting_template_definitions p ON p.id=t.posting_template_definition_id
        JOIN users u ON u.id=t.responsible_user_id LEFT JOIN categories c ON c.id=t.category_id ORDER BY source_key,p.code`),
      entries: await rows(`SELECT coalesce(t.legacy_mongo_id,t.business_snapshot->'sourceRefs'->>0) transaction_key,
        coalesce(a.legacy_mongo_id,g.legacy_mongo_id,l.system_role) ledger_key,e.account_sequence::text,e.amount::text,
        e.balance_before::text,e.balance_after::text,e.entry_role FROM ledger_entries e
        JOIN financial_transactions t ON t.id=e.financial_transaction_id JOIN ledger_accounts l ON l.id=e.ledger_account_id
        LEFT JOIN accounts a ON a.id=l.account_id LEFT JOIN accumulations g ON g.id=l.accumulation_id
        ORDER BY transaction_key,ledger_key,e.account_sequence`),
      incomeDetails: await rows(`SELECT d.legacy_mongo_id,t.legacy_mongo_id transaction_legacy_id,coalesce(a.legacy_mongo_id,g.legacy_mongo_id) ledger_legacy_id
        FROM transaction_income_details d JOIN financial_transactions t ON t.id=d.financial_transaction_id
        JOIN ledger_accounts l ON l.id=d.target_ledger_account_id LEFT JOIN accounts a ON a.id=l.account_id
        LEFT JOIN accumulations g ON g.id=l.accumulation_id ORDER BY d.legacy_mongo_id`),
      expenseDetails: await rows(`SELECT d.legacy_mongo_id,t.legacy_mongo_id transaction_legacy_id,coalesce(a.legacy_mongo_id,g.legacy_mongo_id) ledger_legacy_id
        FROM transaction_expense_details d JOIN financial_transactions t ON t.id=d.financial_transaction_id
        JOIN ledger_accounts l ON l.id=d.source_ledger_account_id LEFT JOIN accounts a ON a.id=l.account_id
        LEFT JOIN accumulations g ON g.id=l.accumulation_id ORDER BY d.legacy_mongo_id`),
      debts: await rows(`SELECT d.legacy_mongo_id,t.legacy_mongo_id transaction_legacy_id,c.legacy_mongo_id contact_legacy_id,d.direction,
        d.principal_amount::text,d.rate_value::text,d.rate_basis,d.due_at::text,d.trust_level,d.status,d.outstanding_principal::text,
        d.outstanding_interest::text FROM debt_agreements d JOIN financial_transactions t ON t.id=d.origin_transaction_id
        JOIN contacts c ON c.id=d.counterparty_contact_id ORDER BY d.legacy_mongo_id`),
      attachments: await rows(`SELECT owner_user.legacy_mongo_id owner_legacy_id,avatar_user.legacy_mongo_id avatar_user_legacy_id,
        transaction.legacy_mongo_id transaction_legacy_id,asset.provider,asset.provider_resource_type,
        encode(digest(asset.secure_url,'sha256'),'hex') secure_url_hash,asset.status asset_status,asset.source_provenance,
        attachment.role,attachment.source_ordinal,attachment.status attachment_status
        FROM attachments attachment JOIN temporary_assets asset ON asset.id=attachment.asset_id
        JOIN users owner_user ON owner_user.id=asset.owner_user_id
        LEFT JOIN users avatar_user ON avatar_user.id=attachment.user_avatar_user_id
        LEFT JOIN financial_transactions transaction ON transaction.id=attachment.financial_transaction_id
        ORDER BY asset.source_provenance->>'sourceCollection',asset.source_provenance->>'sourceLegacyId',attachment.source_ordinal`),
      budgets: await rows(`SELECT b.legacy_mongo_id,c.legacy_mongo_id category_legacy_id,b.starts_at::text,b.ends_at::text,
        a.source_ordinal,a.category_name_snapshot,a.icon_snapshot,a.amount::text,a.repeat_enabled,a.source_ref
        FROM budgets b JOIN budget_allocations a ON a.budget_id=b.id JOIN categories c ON c.id=a.category_id
        ORDER BY b.legacy_mongo_id,a.source_ordinal`),
      notifications: await rows('SELECT legacy_mongo_id,type,title,message,link FROM notifications ORDER BY legacy_mongo_id'),
      recipients: await rows(`SELECT r.legacy_mongo_id,u.legacy_mongo_id user_legacy_id,n.legacy_mongo_id notification_legacy_id,
        r.is_read,r.received_at::text,r.read_at::text FROM user_notifications r JOIN users u ON u.id=r.user_id
        JOIN notifications n ON n.id=r.notification_id ORDER BY r.legacy_mongo_id`),
      provenance: await rows(`SELECT source_collection,source_legacy_id,source_hash,sanitized_document_hash,
        sanitization_policy_version,redaction_manifest,disposition,target_type FROM migration_source_records
        WHERE migration_run_id=$1 ORDER BY source_collection,source_legacy_id`, [migrationRun.id]),
      checkpoints: await rows(`SELECT graph_level,source_collection,status,processed_count::text,loaded_count::text,
        rejected_count::text,canonical_hash FROM migration_checkpoints WHERE migration_run_id=$1 ORDER BY graph_level,source_collection`, [migrationRun.id])
    }
    const targetHash = sha256(canonicalJson(targetSnapshot))
    assertAvatarAttachmentLink(targetSnapshot)
    if (attachmentCount !== 3 || targetSnapshot.attachments.length !== 3) throw new Error('LEGACY_ATTACHMENT_COVERAGE_MISMATCH')
    const finalSummary = {
      sourceSnapshotId: evidence.manifest.sourceSnapshotId,
      evidenceFingerprint: sourceChecksum,
      transformPlanHash: transformPlan.canonicalPlan.planHash,
      identitySpacePlanHash: identitySpacePlan.planHash,
      targetHash,
      sourceCount: summary.sourceCount,
      loadedCount: summary.loadedCount,
      archivedCount: summary.archivedCount,
      rejectedCount: 0,
      checkpointCount: transformPlan.canonicalPlan.routes.length,
      userCount: users.size,
      personalSpaceCount: spaces.size,
      bankCount: banks.size,
      categoryCount: categories.size,
      categoryEdgeCount: edgeKeys.size,
      accountCount: accounts.size,
      accumulationCount: accumulations.size,
      contactCount: contacts.size,
      legacyAssetCount: attachmentCount,
      requiresReviewAttachmentCount: attachmentCount,
      ledgerCount: ledgerByRef.size,
      postingCount: summary.postingCount,
      postingEntryCount: summary.postingEntryCount,
      transactionCount: transactionTargets.size,
      budgetCount: docs.budgets.size,
      notificationCount: notificationIds.size,
      notificationRecipientCount: docs.user_notifications.size,
      unbalancedTransactions: reconciliation.unbalanced,
      ledgerProjectionMismatches: reconciliation.projection_mismatch,
      balanceHoldersCompared: summary.balanceHolderCount,
      balanceMismatches: reconciliation.balance_mismatch,
      toleranceVnd: 0
    }
    await client.query(`UPDATE migration_runs SET status='COMPLETED',completed_at=clock_timestamp(),loaded_count=$1,
      rejected_count=0,summary=$2::jsonb,updated_at=clock_timestamp() WHERE id=$3`, [summary.loadedCount, json(finalSummary), migrationRun.id])
    await client.query(`INSERT INTO audit_events
      (actor_type,action,resource_type,resource_public_id,correlation_id,evidence)
      VALUES ('MIGRATION','W2_EXPORT_DRY_RUN_COMPLETED','migration_run',$1,$2,$3::jsonb)`,
    [migrationRun.public_id, randomUUID(), json({ sourceChecksum, targetHash })])
    await client.query('COMMIT')
    return finalSummary
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

module.exports = {
  EXPECTED_COUNTS,
  CHECKPOINT_GRAPH_LEVEL,
  MAPPING_VERSION,
  SCHEMA_VERSION,
  assertDisposableDatabase,
  assertDisposableUrl,
  createTestcontainerCapability,
  loadWave2Export
}
