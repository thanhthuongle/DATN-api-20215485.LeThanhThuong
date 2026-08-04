const { BSON, ObjectId, Int32, Long, Double, Decimal128 } = require('mongodb')
const { canonicalJson, deepFreeze, sha256 } = require('./wave2-export-manifest.cjs')
const { DECLARED_COLLECTIONS } = require('./wave2-export-reader.cjs')
const { materializeSanitizedEvidence } = require('./wave2-export-sanitizer.cjs')

const TRANSFORM_VERSION = 'wave2-staging-transform-plan-v1'
const ARCHIVE_COLLECTIONS = new Set([
  'money_sources', 'contribution_requests', 'group_payouts', 'invitations',
  'proposal_expenses', 'system_tasks'
])
const APPROVED_ARCHIVE_DEPENDENCIES = new Set(['money_sources', 'contribution_requests', 'proposal_expenses'])
const SCHEMA_ONLY_COLLECTIONS = new Set([
  'contribution_requests', 'group_payouts', 'invitations', 'proposal_expenses'
])
const FINANCIAL_COLLECTIONS = new Set([
  'families', 'categories', 'money_sources', 'accounts', 'accumulations', 'savings_accounts',
  'transactions', 'expenses', 'incomes', 'transfers', 'contributions', 'loans', 'borrowings',
  'collections', 'repayments', 'contacts', 'budgets'
])
const OWNER_TYPES = new Set(['individual', 'family'])
const MONEY_SOURCE_TYPES = new Set(['account', 'savings_account', 'accumulation'])
const SAVING_INTEREST_PAID = new Set(['maturity', 'monthly'])
const SAVING_TERM_ENDED = new Set(['roll_over_principal_and_interest', 'roll_over_principal', 'close_account'])
const NOTIFICATION_TYPE_MAP = Object.freeze({ link: 'LINK', text: 'TEXT', invitation: 'INVITATION' })
const TRANSACTION_TYPES = new Set([
  'expense', 'income', 'loan', 'collect', 'borrowing', 'repayment', 'transfer', 'contribution'
])
const DETAIL_BY_TYPE = Object.freeze({
  expense: 'expenses', income: 'incomes', transfer: 'transfers', contribution: 'contributions',
  loan: 'loans', borrowing: 'borrowings', collect: 'collections', repayment: 'repayments'
})

const SYSTEM_ACCOUNT_REGISTRY = deepFreeze({
  OPENING_EQUITY: { normalSide: 'CREDIT', allowsNegativeBalance: true, description: 'Counter-account for explicit signed opening balances.' },
  MIGRATION_EQUITY: { normalSide: 'CREDIT', allowsNegativeBalance: true, description: 'Audited counter-account for approved migration anchors only.' },
  INCOME_CLEARING: { normalSide: 'CREDIT', allowsNegativeBalance: true, description: 'Space-local counter-account for externally sourced income.' },
  EXPENSE_CLEARING: { normalSide: 'DEBIT', allowsNegativeBalance: false, description: 'Space-local counter-account for externally consumed expense.' },
  LOAN_RECEIVABLE: { normalSide: 'DEBIT', allowsNegativeBalance: false, description: 'Space-local principal receivable for loan disbursement and collection.' },
  BORROWING_LIABILITY: { normalSide: 'CREDIT', allowsNegativeBalance: true, description: 'Space-local principal liability for borrowing and repayment.' },
  INTEREST_EXPENSE: { normalSide: 'DEBIT', allowsNegativeBalance: true, description: 'Space-local source for explicitly recognized saving interest.' },
  INTERSPACE_CLEARING: { normalSide: 'DEBIT', allowsNegativeBalance: true, description: 'Space-local clearing side for an atomic personal-to-family contribution.' }
})

const role = (entryRole, accountKind, sign, systemRole = null, minimum = 1, maximum = 1) => ({
  entryRole, accountKind, systemRole, sign, minimum, maximum
})
const userRole = (entryRole, sign, minimum, maximum) => role(entryRole, 'USER_BALANCE', sign, null, minimum, maximum)
const systemRole = (entryRole, code, sign, minimum, maximum) => role(entryRole, 'SYSTEM', sign, code, minimum, maximum)
const template = (transactionType, roles) => ({ version: 1, transactionType, roles })
const TEMPLATE_REGISTRY = deepFreeze({
  OPENING_BALANCE: template('ACCOUNT_OPENING', [userRole('ACCOUNT', 'VARIABLE'), systemRole('OPENING_EQUITY', 'OPENING_EQUITY', 'VARIABLE', 0, 1), systemRole('MIGRATION_EQUITY', 'MIGRATION_EQUITY', 'VARIABLE', 0, 1)]),
  ACCUMULATION_OPENING: template('ACCUMULATION_OPENING', []),
  INCOME: template('INCOME', [userRole('TARGET', 'POSITIVE'), systemRole('INCOME_CLEARING', 'INCOME_CLEARING', 'NEGATIVE')]),
  EXPENSE: template('EXPENSE', [userRole('SOURCE', 'NEGATIVE'), systemRole('EXPENSE_CLEARING', 'EXPENSE_CLEARING', 'POSITIVE')]),
  TRANSFER: template('TRANSFER', [userRole('SOURCE', 'NEGATIVE'), userRole('TARGET', 'POSITIVE')]),
  CONTRIBUTION_OUT: template('CONTRIBUTION', [userRole('SOURCE', 'NEGATIVE'), systemRole('INTERSPACE_CLEARING_OUT', 'INTERSPACE_CLEARING', 'POSITIVE')]),
  CONTRIBUTION_IN: template('CONTRIBUTION', [systemRole('INTERSPACE_CLEARING_IN', 'INTERSPACE_CLEARING', 'NEGATIVE'), userRole('TARGET', 'POSITIVE')]),
  LOAN_DISBURSEMENT: template('LOAN_DISBURSEMENT', [userRole('CASH_SOURCE', 'NEGATIVE'), systemRole('LOAN_RECEIVABLE', 'LOAN_RECEIVABLE', 'POSITIVE')]),
  BORROWING: template('BORROWING', [userRole('CASH_TARGET', 'POSITIVE'), systemRole('BORROWING_LIABILITY', 'BORROWING_LIABILITY', 'NEGATIVE')]),
  REPAYMENT: template('REPAYMENT', [userRole('CASH_SOURCE', 'NEGATIVE'), systemRole('BORROWING_LIABILITY', 'BORROWING_LIABILITY', 'POSITIVE')]),
  COLLECTION: template('COLLECTION', [userRole('CASH_TARGET', 'POSITIVE'), systemRole('LOAN_RECEIVABLE', 'LOAN_RECEIVABLE', 'NEGATIVE')]),
  ACCUMULATION_CLOSE: template('ACCUMULATION_CLOSE', [userRole('ACCUMULATION_SOURCE', 'NEGATIVE'), userRole('TARGET', 'POSITIVE')]),
  SAVING_DEPOSIT: template('SAVING_DEPOSIT', [userRole('SOURCE', 'NEGATIVE'), userRole('SAVING_TARGET', 'POSITIVE')]),
  SAVING_INTEREST_MONTHLY: template('SAVING_INTEREST_MONTHLY', [systemRole('INTEREST_EXPENSE', 'INTEREST_EXPENSE', 'NEGATIVE'), userRole('SAVING_INTEREST_CREDIT', 'POSITIVE'), userRole('SAVING_PAYOUT', 'NEGATIVE'), userRole('INTEREST_TARGET', 'POSITIVE')]),
  SAVING_INTEREST_MATURITY: template('SAVING_INTEREST_MATURITY', [systemRole('INTEREST_EXPENSE', 'INTEREST_EXPENSE', 'NEGATIVE'), userRole('SAVING_INTEREST_CREDIT', 'POSITIVE'), userRole('SAVING_PAYOUT', 'NEGATIVE', 0, 1), userRole('INTEREST_TARGET', 'POSITIVE', 0, 1)]),
  SAVING_CLOSE: template('SAVING_CLOSE', [systemRole('INTEREST_EXPENSE', 'INTEREST_EXPENSE', 'NEGATIVE', 0, 1), userRole('SAVING_INTEREST_CREDIT', 'POSITIVE', 0, 1), userRole('SAVING_SOURCE', 'NEGATIVE'), userRole('TARGET', 'POSITIVE')]),
  SAVING_ROLLOVER_PRINCIPAL: template('SAVING_ROLLOVER_PRINCIPAL', [userRole('OLD_SAVING', 'NEGATIVE'), userRole('NEW_SAVING', 'POSITIVE')]),
  SAVING_ROLLOVER_PRINCIPAL_INTEREST: template('SAVING_ROLLOVER_PRINCIPAL_INTEREST', [systemRole('INTEREST_EXPENSE', 'INTEREST_EXPENSE', 'NEGATIVE'), userRole('OLD_SAVING_INTEREST_CREDIT', 'POSITIVE'), userRole('OLD_SAVING', 'NEGATIVE'), userRole('NEW_SAVING', 'POSITIVE')])
})

const common = ['_id', 'createdAt', 'updatedAt', '_destroy']
const schema = (required, fields, types = {}) => ({
  required: new Set(['_id', ...required]),
  fields: new Set([...common, ...fields]),
  types
})

const SOURCE_SCHEMAS = Object.freeze({
  users: schema(['email', 'password', 'username', 'displayName'], [
    'email', 'password', 'username', 'displayName', 'avatar', 'isActive', 'verifyToken', 'language',
    'currency', 'remindToInput', 'remindTime', 'startDayOfWeek', 'startDayOfMonth'
  ], { email: 'string', password: 'string', username: 'string', displayName: 'string', isActive: 'boolean' }),
  families: schema(['familyName', 'ownerId'], ['familyName', 'backgroundImage', 'ownerId', 'managerIds', 'memberIds']),
  banks: schema(['code', 'name'], ['code', 'name', 'logo'], { code: 'string', name: 'string' }),
  categories: schema(['ownerType', 'ownerId', 'name', 'type'], [
    'ownerType', 'ownerId', 'name', 'type', 'allowDelete', 'icon', 'childrenIds', 'parentIds'
  ], { ownerType: 'string', name: 'string', type: 'string', childrenIds: 'objectIdArray', parentIds: 'objectIdArray' }),
  money_sources: schema(['ownerType', 'ownerId'], [
    'ownerType', 'ownerId', 'accountIds', 'savings_accountIds', 'accumulationIds'
  ], { ownerType: 'string', accountIds: 'objectIdArray', savings_accountIds: 'objectIdArray', accumulationIds: 'objectIdArray' }),
  accounts: schema(['ownerType', 'ownerId', 'moneySourceId', 'type', 'accountName', 'initBalance', 'balance'], [
    'ownerType', 'ownerId', 'moneySourceId', 'type', 'accountName', 'initBalance', 'balance', 'bankId',
    'description', 'icon', 'isBlock', 'transactionIds'
  ], { ownerType: 'string', type: 'string', accountName: 'string', initBalance: 'safeInteger', balance: 'safeInteger', transactionIds: 'objectIdArray' }),
  accumulations: schema(['ownerType', 'ownerId', 'moneySourceId', 'accumulationName', 'balance', 'targetBalance', 'startDate', 'endDate'], [
    'ownerType', 'ownerId', 'moneySourceId', 'accumulationName', 'balance', 'targetBalance', 'startDate',
    'endDate', 'isFinish', 'transactionIds', 'description'
  ], { ownerType: 'string', accumulationName: 'string', balance: 'safeInteger', targetBalance: 'safeInteger', startDate: 'time', endDate: 'time', transactionIds: 'objectIdArray' }),
  savings_accounts: schema(['ownerType', 'ownerId', 'moneySourceId', 'savingsAccountName', 'bankId', 'initBalance', 'balance', 'rate', 'nonTermRate', 'startDate', 'term', 'interestPaid', 'termEnded', 'moneyFromType', 'moneyFromId'], [
    'ownerType', 'ownerId', 'moneySourceId', 'savingsAccountName', 'bankId', 'initBalance', 'balance',
    'rate', 'nonTermRate', 'startDate', 'term', 'interestPaid', 'termEnded', 'interestPaidTargetId',
    'interestPaidTargetType', 'description', 'isClosed', 'isRolledOver', 'parentSavingId', 'transactionIds',
    'moneyFromType', 'moneyFromId'
  ], { initBalance: 'safeInteger', balance: 'safeInteger', rate: 'number', nonTermRate: 'number', startDate: 'time', term: 'safeInteger' }),
  transactions: schema(['ownerType', 'ownerId', 'responsiblePersonId', 'type', 'categoryId', 'name', 'amount', 'transactionTime'], [
    'ownerType', 'ownerId', 'responsiblePersonId', 'proposalId', 'type', 'categoryId', 'name',
    'description', 'amount', 'transactionTime'
  ], { ownerType: 'string', type: 'string', name: 'string', amount: 'safeInteger', transactionTime: 'time' }),
  expenses: schema(['transactionId', 'moneyFromType', 'moneyFromId'], ['transactionId', 'moneyFromType', 'moneyFromId', 'images'], { moneyFromType: 'string', images: 'stringArray' }),
  incomes: schema(['transactionId', 'moneyTargetType', 'moneyTargetId'], ['transactionId', 'moneyTargetType', 'moneyTargetId', 'images'], { moneyTargetType: 'string', images: 'stringArray' }),
  transfers: schema(['transactionId', 'moneyFromType', 'moneyFromId', 'moneyTargetType', 'moneyTargetId'], ['transactionId', 'moneyFromType', 'moneyFromId', 'moneyTargetType', 'moneyTargetId', 'fee', 'images'], { fee: 'safeInteger', images: 'stringArray' }),
  contributions: schema(['transactionId', 'recipientId', 'moneyFromType', 'moneyFromId', 'moneyTargetType', 'moneyTargetId'], ['transactionId', 'recipientId', 'moneyFromType', 'moneyFromId', 'moneyTargetType', 'moneyTargetId', 'contributionRequestId', 'images'], { images: 'stringArray' }),
  loans: schema(['transactionId', 'moneyFromType', 'moneyFromId', 'borrowerId', 'rate'], ['transactionId', 'moneyFromType', 'moneyFromId', 'borrowerId', 'rate', 'collectTime', 'trustLevel', 'images'], { moneyFromType: 'string', rate: 'number', collectTime: 'time', images: 'stringArray' }),
  borrowings: schema(['transactionId', 'moneyTargetType', 'moneyTargetId', 'lenderId', 'rate'], ['transactionId', 'moneyTargetType', 'moneyTargetId', 'lenderId', 'rate', 'repaymentTime', 'images'], { moneyTargetType: 'string', rate: 'number', repaymentTime: 'time', images: 'stringArray' }),
  collections: schema(['transactionId', 'loanTransactionId', 'borrowerId', 'moneyTargetType', 'moneyTargetId', 'realCollectTime'], ['transactionId', 'loanTransactionId', 'borrowerId', 'moneyTargetType', 'moneyTargetId', 'realCollectTime', 'images'], { moneyTargetType: 'string', realCollectTime: 'time', images: 'stringArray' }),
  repayments: schema(['transactionId', 'borrowingTransactionId', 'lenderId', 'moneyFromType', 'moneyFromId', 'realRepaymentTime'], ['transactionId', 'borrowingTransactionId', 'lenderId', 'moneyFromType', 'moneyFromId', 'realRepaymentTime', 'images'], { moneyFromType: 'string', realRepaymentTime: 'time', images: 'stringArray' }),
  contacts: schema(['ownerType', 'ownerId', 'name'], ['ownerType', 'ownerId', 'name', 'trustLevel'], { ownerType: 'string', name: 'string' }),
  budgets: schema(['ownerType', 'ownerId', 'startTime', 'endTime', 'categories'], ['ownerType', 'ownerId', 'startTime', 'endTime', 'categories'], { ownerType: 'string', startTime: 'time', endTime: 'time', categories: 'array' }),
  notifications: schema(['title', 'message', 'type'], ['title', 'message', 'type', 'link'], { title: 'string', message: 'string', type: 'string', link: 'string' }),
  user_notifications: schema(['userId', 'notificationId', 'isRead', 'receiveAt'], ['userId', 'notificationId', 'isRead', 'readAt', 'receiveAt'], { userId: 'objectId', notificationId: 'objectId', isRead: 'boolean', readAt: 'time', receiveAt: 'time' }),
  contribution_requests: schema([], ['ownerType', 'ownerId', 'familyId', 'name', 'description', 'amount', 'moneyTargetType', 'moneyTargetId', 'deadline', 'contributerIds']),
  group_payouts: schema([], ['transactionId', 'recipientId', 'moneyFromType', 'moneyFromId', 'moneyTargetType', 'moneyTargetId', 'images']),
  invitations: schema([], ['inviterId', 'inviteeId', 'familyId', 'status']),
  proposal_expenses: schema([], ['ownerType', 'ownerId', 'targetId', 'name', 'amount', 'categoryId', 'description', 'status', 'images', 'reviewerId', 'reviewed_at']),
  system_tasks: schema([], ['type', 'data', 'scheduleTime', 'repeat', 'status', 'name', 'priority', 'nextRunAt', 'lockedAt', 'lastModifiedBy', 'lastRunAt', 'lastFinishedAt', 'failedAt', 'failCount', 'failReason', 'repeatInterval', 'repeatTimezone', 'repeatAt', 'shouldSaveResult', 'result', 'disabled', 'startDate', 'endDate', 'skipDays'])
})

const idOf = (value) => value instanceof ObjectId ? value.toHexString() : null
const relationId = (value) => {
  if (value instanceof ObjectId) return value.toHexString()
  if (typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)) return value.toLowerCase()
  return null
}
const numberValue = (value) => {
  if (value instanceof Int32 || value instanceof Long || value instanceof Double || value instanceof Decimal128) return Number(value.toString())
  return typeof value === 'number' ? value : NaN
}
const exactNumericText = (value) => {
  if (value instanceof Int32 || value instanceof Long || value instanceof Double || value instanceof Decimal128) return value.toString()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}
const validRateText = (value) => {
  const text = exactNumericText(value)
  if (!text || !/^(?:0|[1-9]\d{0,2})(?:\.\d{1,4})?$/.test(text)) return null
  const numeric = Number(text)
  return numeric >= 0 && numeric <= 100 ? text : null
}
const safeInteger = (value) => {
  const number = numberValue(value)
  return Number.isSafeInteger(number) ? number : null
}
const instant = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  const epoch = safeInteger(value)
  if (epoch !== null && !Number.isNaN(new Date(epoch).getTime())) return new Date(epoch).toISOString()
  if (typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString()
  }
  return null
}
const savingMaturityInstant = (saving) => {
  const start = instant(saving.startDate)
  const term = safeInteger(saving.term)
  if (!start || term === null || term < 1) return null
  const maturity = new Date(start)
  maturity.setUTCMonth(maturity.getUTCMonth() + term)
  return maturity.toISOString()
}
const normalized = (value) => typeof value === 'string' ? value.trim().toLocaleLowerCase('en-US') : null
const sortedUnique = (values) => [...new Set(values)].sort()
const freezeJson = (value) => deepFreeze(JSON.parse(canonicalJson(value)))

const validateType = (value, expected) => {
  if (value === null || value === undefined) return true
  if (expected === 'string') return typeof value === 'string'
  if (expected === 'boolean') return typeof value === 'boolean'
  if (expected === 'safeInteger') return safeInteger(value) !== null
  if (expected === 'number') return Number.isFinite(numberValue(value))
  if (expected === 'time') return instant(value) !== null
  if (expected === 'array') return Array.isArray(value)
  if (expected === 'objectIdArray') return Array.isArray(value) && value.every((item) => idOf(item))
  if (expected === 'objectId') return relationId(value) !== null
  if (expected === 'stringArray') return Array.isArray(value) && value.every((item) => typeof item === 'string')
  return false
}

const buildWave2TransformPlan = (sanitizedSnapshot) => {
  const materialized = materializeSanitizedEvidence(sanitizedSnapshot, { includeOperational: true })
  const sanitizedManifest = materialized.manifest

  const records = new Map()
  const byId = new Map()
  const recordState = new Map()
  const discrepancies = []

  const addIssue = (collection, legacyId, code, severity, path = null) => {
    const issue = { collection, legacyId, code, severity, path }
    discrepancies.push(issue)
    const state = recordState.get(`${collection}:${legacyId}`)
    if (state && severity === 'BLOCKING' && !ARCHIVE_COLLECTIONS.has(collection)) state.rejected = true
  }
  const blockingSchemaCollection = (collection) =>
    FINANCIAL_COLLECTIONS.has(collection) || ['users', 'notifications', 'user_notifications'].includes(collection)

  for (const collection of DECLARED_COLLECTIONS) {
    const collectionRecords = materialized.operationalByCollection.get(collection)
    records.set(collection, collectionRecords)
    const index = new Map()
    for (const document of collectionRecords) {
      const legacyId = idOf(document._id)
      if (!legacyId) throw new Error(`Validated snapshot exposed invalid _id for ${collection}`)
      index.set(legacyId, document)
      recordState.set(`${collection}:${legacyId}`, { rejected: false })
      const spec = SOURCE_SCHEMAS[collection]
      for (const key of Object.keys(document)) {
        if (!spec.fields.has(key)) {
          const safePath = `field_${sha256(`${collection}|${legacyId}|${key}`).slice(0, 16)}`
          addIssue(collection, legacyId, 'UNKNOWN_SOURCE_FIELD',
            FINANCIAL_COLLECTIONS.has(collection) ? 'BLOCKING' : 'REQUIRES_REVIEW', safePath)
        }
      }
      for (const key of spec.required) {
        if (document[key] === null || document[key] === undefined) {
          addIssue(collection, legacyId, 'MISSING_REQUIRED_FIELD',
            blockingSchemaCollection(collection) ? 'BLOCKING' : 'REQUIRES_REVIEW', key)
          if (!ARCHIVE_COLLECTIONS.has(collection)) recordState.get(`${collection}:${legacyId}`).rejected = true
        }
      }
      for (const [key, expected] of Object.entries(spec.types)) {
        if (!validateType(document[key], expected)) {
          addIssue(collection, legacyId, 'INVALID_BSON_TYPE',
            blockingSchemaCollection(collection) ? 'BLOCKING' : 'REQUIRES_REVIEW', key)
          if (!ARCHIVE_COLLECTIONS.has(collection)) recordState.get(`${collection}:${legacyId}`).rejected = true
        }
      }
    }
    byId.set(collection, index)
  }

  const dependenciesByIdentity = new Map()
  const addDependency = (identity, dependency) => {
    if (!identity || !dependency) return
    if (!dependenciesByIdentity.has(identity)) dependenciesByIdentity.set(identity, new Set())
    dependenciesByIdentity.get(identity).add(dependency)
  }
  const isLoaded = (identity) => {
    const separator = identity.indexOf(':')
    const collection = identity.slice(0, separator)
    return !ARCHIVE_COLLECTIONS.has(collection) && recordState.has(identity) && !recordState.get(identity).rejected
  }
  const dependencyAvailable = (identity) =>
    isLoaded(identity) || (recordState.has(identity) && APPROVED_ARCHIVE_DEPENDENCIES.has(identity.split(':')[0]))
  const dependencyClosure = (identities) => {
    const closure = new Set(identities)
    const pending = [...identities]
    while (pending.length) {
      const identity = pending.pop()
      for (const dependency of dependenciesByIdentity.get(identity) || []) {
        if (!closure.has(dependency)) {
          closure.add(dependency)
          pending.push(dependency)
        }
      }
    }
    return sortedUnique([...closure])
  }

  const unique = (collection, keyOf, code = 'DUPLICATE_BUSINESS_KEY') => {
    const seen = new Map()
    for (const document of records.get(collection)) {
      const key = keyOf(document)
      if (!key) continue
      const legacyId = idOf(document._id)
      if (seen.has(key)) {
        addIssue(collection, legacyId, code, 'BLOCKING')
        addIssue(collection, seen.get(key), code, 'BLOCKING')
      } else seen.set(key, legacyId)
    }
  }
  unique('users', (document) => normalized(document.email), 'IDENTITY_BUSINESS_KEY_DUPLICATE')
  unique('users', (document) => normalized(document.username), 'IDENTITY_BUSINESS_KEY_DUPLICATE')
  unique('banks', (document) => normalized(document.code), 'BANK_CODE_DUPLICATE')
  unique('money_sources', (document) => `${document.ownerType}:${relationId(document.ownerId)}`, 'MONEY_SOURCE_OWNER_DUPLICATE')
  unique('contacts', (document) => `${document.ownerType}:${relationId(document.ownerId)}:${normalized(document.name)}`, 'CONTACT_NAME_DUPLICATE')
  unique('categories', (document) => `${document.ownerType}:${relationId(document.ownerId)}:${document.type}:${normalized(document.name)}`, 'CATEGORY_NAME_DUPLICATE')
  unique('user_notifications', (document) => `${relationId(document.userId)}:${relationId(document.notificationId)}`, 'RECIPIENT_STATE_DUPLICATE')

  const users = byId.get('users')
  const families = byId.get('families')
  const resolveSpace = (collection, document) => {
    const legacyId = idOf(document._id)
    const ownerId = relationId(document.ownerId)
    if (!OWNER_TYPES.has(document.ownerType) || !ownerId ||
        (document.ownerType === 'individual' ? !users.has(ownerId) : !families.has(ownerId))) {
      addIssue(collection, legacyId, 'UNRESOLVED_FINANCIAL_SPACE', 'BLOCKING', 'ownerId')
      return null
    }
    addDependency(`${collection}:${legacyId}`, `${document.ownerType === 'individual' ? 'users' : 'families'}:${ownerId}`)
    return `${document.ownerType}:${ownerId}`
  }

  const spaces = new Map()
  for (const family of records.get('families')) {
    const familyId = idOf(family._id)
    const ownerId = relationId(family.ownerId)
    if (!ownerId || !users.has(ownerId)) addIssue('families', familyId, 'UNRESOLVED_FINANCIAL_SPACE', 'BLOCKING', 'ownerId')
    spaces.set(`families:${familyId}`, ownerId ? `family:${familyId}` : null)
    if (ownerId) addDependency(`families:${familyId}`, `users:${ownerId}`)
  }
  for (const collection of ['categories', 'money_sources', 'accounts', 'accumulations', 'savings_accounts', 'transactions', 'contacts', 'budgets']) {
    for (const document of records.get(collection)) spaces.set(`${collection}:${idOf(document._id)}`, resolveSpace(collection, document))
  }

  for (const family of records.get('families')) {
    const familyId = idOf(family._id)
    const ownerId = relationId(family.ownerId)
    for (const key of ['managerIds', 'memberIds']) {
      const ids = family[key] || []
      if (!Array.isArray(ids) || ids.some((value) => !idOf(value) || !users.has(idOf(value)))) {
        addIssue('families', familyId, 'UNRESOLVED_MEMBERSHIP', 'BLOCKING', key)
      }
      for (const value of ids) {
        const memberId = idOf(value)
        if (memberId) addDependency(`families:${familyId}`, `users:${memberId}`)
      }
    }
    if (!users.has(ownerId)) addIssue('families', familyId, 'UNRESOLVED_MEMBERSHIP', 'BLOCKING', 'ownerId')
  }

  for (const category of records.get('categories')) {
    const categoryId = idOf(category._id)
    const categorySpace = spaces.get(`categories:${categoryId}`)
    for (const key of ['childrenIds', 'parentIds']) {
      for (const value of category[key] || []) {
        const relatedId = idOf(value)
        const related = byId.get('categories').get(relatedId)
        if (!related || spaces.get(`categories:${relatedId}`) !== categorySpace || relatedId === categoryId) {
          addIssue('categories', categoryId, 'INVALID_CATEGORY_GRAPH_REFERENCE', 'BLOCKING', key)
        }
        if (relatedId) addDependency(`categories:${categoryId}`, `categories:${relatedId}`)
      }
    }
  }

  const holderCollections = { account: 'accounts', accumulation: 'accumulations', savings_account: 'savings_accounts' }
  const holderIndex = new Map()
  for (const [type, collection] of Object.entries(holderCollections)) {
    for (const holder of records.get(collection)) holderIndex.set(`${type}:${idOf(holder._id)}`, { type, collection, document: holder })
  }
  const resolveHolder = (type, value, expectedSpace, sourceCollection, sourceId, path) => {
    const id = relationId(value)
    const holder = MONEY_SOURCE_TYPES.has(type) && id ? holderIndex.get(`${type}:${id}`) : null
    if (!holder || spaces.get(`${holder.collection}:${id}`) !== expectedSpace) {
      addIssue(sourceCollection, sourceId, 'UNRESOLVED_MONEY_REFERENCE', 'BLOCKING', path)
      return null
    }
    return `${type}:${id}`
  }

  for (const collection of ['accounts', 'accumulations', 'savings_accounts']) {
    for (const holder of records.get(collection)) {
      const legacyId = idOf(holder._id)
      const envelopeId = relationId(holder.moneySourceId)
      const envelope = byId.get('money_sources').get(envelopeId)
      if (!envelope || spaces.get(`money_sources:${envelopeId}`) !== spaces.get(`${collection}:${legacyId}`)) {
        addIssue(collection, legacyId, 'UNRESOLVED_MONEY_SOURCE_ENVELOPE', 'BLOCKING', 'moneySourceId')
      }
      if (collection === 'accounts' && holder.type === 'bank' && !byId.get('banks').has(relationId(holder.bankId))) {
        addIssue(collection, legacyId, 'UNRESOLVED_BANK_REFERENCE', 'BLOCKING', 'bankId')
      }
      if (collection === 'savings_accounts' && !byId.get('banks').has(relationId(holder.bankId))) {
        addIssue(collection, legacyId, 'UNRESOLVED_BANK_REFERENCE', 'BLOCKING', 'bankId')
      }
      if ((collection === 'accounts' && holder.type === 'bank') || collection === 'savings_accounts') {
        const bankId = relationId(holder.bankId)
        if (bankId) addDependency(`${collection}:${legacyId}`, `banks:${bankId}`)
      }
      if (envelopeId) addDependency(`${collection}:${legacyId}`, `money_sources:${envelopeId}`)
    }
  }
  for (const envelope of records.get('money_sources')) {
    const envelopeId = idOf(envelope._id)
    const comparisons = [
      ['accountIds', 'accounts'], ['accumulationIds', 'accumulations'], ['savings_accountIds', 'savings_accounts']
    ]
    for (const [key, collection] of comparisons) {
      const expected = records.get(collection)
        .filter((holder) => relationId(holder.moneySourceId) === envelopeId).map((holder) => idOf(holder._id))
      const actual = (envelope[key] || []).map(idOf).filter(Boolean)
      if (canonicalJson(sortedUnique(actual)) !== canonicalJson(sortedUnique(expected))) {
        addIssue('money_sources', envelopeId, 'CONFLICTING_REVERSE_RELATION', 'BLOCKING', key)
      }
    }
  }

  const transactions = byId.get('transactions')
  for (const transaction of records.get('transactions')) {
    const transactionId = idOf(transaction._id)
    const transactionIdentity = `transactions:${transactionId}`
    const transactionSpace = spaces.get(`transactions:${transactionId}`)
    const categoryId = relationId(transaction.categoryId)
    const responsibleId = relationId(transaction.responsiblePersonId)
    const ownerId = relationId(transaction.ownerId)
    const proposalId = relationId(transaction.proposalId)
    if (ownerId && OWNER_TYPES.has(transaction.ownerType)) {
      addDependency(transactionIdentity, `${transaction.ownerType === 'individual' ? 'users' : 'families'}:${ownerId}`)
    }
    if (responsibleId) addDependency(transactionIdentity, `users:${responsibleId}`)
    if (categoryId) addDependency(transactionIdentity, `categories:${categoryId}`)
    if (proposalId) addDependency(transactionIdentity, `proposal_expenses:${proposalId}`)
    if (!TRANSACTION_TYPES.has(transaction.type)) addIssue('transactions', transactionId, 'INVALID_TRANSACTION_ENUM', 'BLOCKING', 'type')
    if (safeInteger(transaction.amount) === null || safeInteger(transaction.amount) <= 0) addIssue('transactions', transactionId, 'INVALID_FINANCIAL_VALUE', 'BLOCKING', 'amount')
    if (!instant(transaction.transactionTime)) addIssue('transactions', transactionId, 'INVALID_OR_AMBIGUOUS_TIME', 'BLOCKING', 'transactionTime')
    if (!users.has(responsibleId)) addIssue('transactions', transactionId, 'UNRESOLVED_RESPONSIBLE_USER', 'BLOCKING', 'responsiblePersonId')
    if (transaction.ownerType === 'individual' && responsibleId !== ownerId) {
      addIssue('transactions', transactionId, 'RESPONSIBLE_USER_NOT_PERSONAL_OWNER', 'BLOCKING', 'responsiblePersonId')
    }
    if (transaction.ownerType === 'family') {
      const family = families.get(relationId(transaction.ownerId))
      const members = family ? [family.ownerId, ...(family.managerIds || []), ...(family.memberIds || [])].map(relationId) : []
      if (!members.includes(responsibleId)) {
        addIssue('transactions', transactionId, 'RESPONSIBLE_USER_NOT_SPACE_MEMBER', 'BLOCKING', 'responsiblePersonId')
      }
    }
    if (!byId.get('categories').has(categoryId) || spaces.get(`categories:${categoryId}`) !== transactionSpace) {
      addIssue('transactions', transactionId, 'UNRESOLVED_CATEGORY_REFERENCE', 'BLOCKING', 'categoryId')
    }
  }

  const detailsForTransaction = new Map()
  const detailCollections = Object.values(DETAIL_BY_TYPE)
  for (const collection of detailCollections) {
    for (const detail of records.get(collection)) {
      const detailId = idOf(detail._id)
      const transactionId = relationId(detail.transactionId)
      if (!detailsForTransaction.has(transactionId)) detailsForTransaction.set(transactionId, [])
      detailsForTransaction.get(transactionId).push({ collection, detail })
      if (transactionId) addDependency(`${collection}:${detailId}`, `transactions:${transactionId}`)
      if (!transactions.has(transactionId)) addIssue(collection, detailId, 'UNRESOLVED_TRANSACTION_HEADER', 'BLOCKING', 'transactionId')
    }
  }
  for (const transaction of records.get('transactions')) {
    const transactionId = idOf(transaction._id)
    const matches = detailsForTransaction.get(transactionId) || []
    if (matches.length !== 1 || matches[0]?.collection !== DETAIL_BY_TYPE[transaction.type]) {
      addIssue('transactions', transactionId, 'MISSING_DUPLICATE_OR_WRONG_DETAIL', 'BLOCKING')
      for (const match of matches) addIssue(match.collection, idOf(match.detail._id), 'MISSING_DUPLICATE_OR_WRONG_DETAIL', 'BLOCKING')
    } else {
      addDependency(`transactions:${transactionId}`, `${matches[0].collection}:${idOf(matches[0].detail._id)}`)
    }
  }

  const detailDistribution = Object.fromEntries(detailCollections.map((collection) => [collection, records.get(collection).length]))
  const facts = new Map()
  const settlementOrigins = new Map()
  const holderSpace = (holderKey) => {
    const holder = holderIndex.get(holderKey)
    return holder ? spaces.get(`${holder.collection}:${idOf(holder.document._id)}`) : null
  }
  for (const transaction of records.get('transactions')) {
    const transactionId = idOf(transaction._id)
    const matches = detailsForTransaction.get(transactionId) || []
    if (matches.length !== 1 || matches[0].collection !== DETAIL_BY_TYPE[transaction.type]) continue
    const detailInfo = matches[0]
    const detail = detailInfo.detail
    const detailId = idOf(detail._id)
    const space = spaces.get(`transactions:${transactionId}`)
    const fact = { transaction, transactionId, detailInfo, detail, detailId, space, dependencies: [] }
    const sourceType = detail.moneyFromType
    const sourceId = relationId(detail.moneyFromId)
    const targetType = detail.moneyTargetType
    const targetId = relationId(detail.moneyTargetId)
    if (sourceType && transaction.type !== 'contribution') fact.source = resolveHolder(sourceType, detail.moneyFromId, space, detailInfo.collection, detailId, 'moneyFromId')
    if (targetType && transaction.type !== 'contribution') fact.target = resolveHolder(targetType, detail.moneyTargetId, space, detailInfo.collection, detailId, 'moneyTargetId')
    for (const holderKey of [fact.source, fact.target].filter(Boolean)) {
      const holder = holderIndex.get(holderKey)
      fact.dependencies.push(`${holder.collection}:${idOf(holder.document._id)}`)
    }
    if (transaction.type === 'transfer') {
      const fee = detail.fee == null ? 0 : safeInteger(detail.fee)
      const sourceHolder = fact.source ? holderIndex.get(fact.source) : null
      const rawSourceHolder = holderIndex.get(`${sourceType}:${sourceId}`)
      const rawTargetHolder = holderIndex.get(`${targetType}:${targetId}`)
      const sourceInactive = sourceHolder && (
        sourceHolder.document.isBlock === true || sourceHolder.document.isClosed === true ||
        sourceHolder.document.isFinish === true
      )
      if (fee === null || fee < 0) addIssue('transfers', detailId, 'INVALID_TRANSFER_FEE', 'BLOCKING', 'fee')
      if (fact.source && fact.source === fact.target) addIssue('transfers', detailId, 'TRANSFER_SOURCE_EQUALS_TARGET', 'BLOCKING')
      if (sourceInactive) addIssue('transfers', detailId, 'TRANSFER_SOURCE_INACTIVE_OR_BLOCKED', 'BLOCKING', 'moneyFromId')
      if (rawSourceHolder && rawTargetHolder && holderSpace(`${sourceType}:${sourceId}`) !== holderSpace(`${targetType}:${targetId}`)) {
        addIssue('transfers', detailId, 'CROSS_SPACE_TRANSFER', 'BLOCKING')
      }
    }

    if (transaction.type === 'loan' || transaction.type === 'borrowing') {
      const contactField = transaction.type === 'loan' ? 'borrowerId' : 'lenderId'
      const contactId = relationId(detail[contactField])
      if (!byId.get('contacts').has(contactId) || spaces.get(`contacts:${contactId}`) !== space) {
        addIssue(detailInfo.collection, detailId, 'UNRESOLVED_CONTACT_REFERENCE', 'BLOCKING', contactField)
      }
      if (contactId) fact.dependencies.push(`contacts:${contactId}`)
      const rate = validRateText(detail.rate)
      if (!rate) addIssue(detailInfo.collection, detailId, 'INVALID_DEBT_RATE', 'BLOCKING', 'rate')
      fact.debt = {
        agreementTransactionLegacyId: transactionId,
        agreementDetailLegacyId: detailId,
        contactLegacyId: contactId,
        principalAmount: safeInteger(transaction.amount),
        rate,
        rateBasis: 'UNSPECIFIED',
        space
      }
    }
    if (transaction.type === 'contribution') {
      const sourceHolder = holderIndex.get(`${sourceType}:${sourceId}`)
      const targetHolder = holderIndex.get(`${targetType}:${targetId}`)
      const sourceSpace = sourceHolder ? holderSpace(`${sourceType}:${sourceId}`) : null
      const targetSpace = targetHolder ? holderSpace(`${targetType}:${targetId}`) : null
      const familyId = relationId(detail.recipientId)
      const family = families.get(familyId)
      const contributorId = relationId(transaction.responsiblePersonId)
      const members = family ? [family.ownerId, ...(family.managerIds || []), ...(family.memberIds || [])].map(relationId) : []
      const contributor = users.get(contributorId)
      if (!sourceHolder || !targetHolder || sourceSpace !== `individual:${contributorId}` ||
          targetSpace !== `family:${familyId}` || !members.includes(contributorId) || contributor?.isActive !== true) {
        addIssue('contributions', detailId, 'INVALID_CONTRIBUTION_MEMBERSHIP_OR_SPACE', 'BLOCKING')
      }
      fact.source = sourceHolder ? `${sourceType}:${sourceId}` : null
      fact.target = targetHolder ? `${targetType}:${targetId}` : null
      fact.sourceSpace = sourceSpace
      fact.targetSpace = targetSpace
      if (sourceHolder) fact.dependencies.push(`${sourceHolder.collection}:${sourceId}`)
      if (targetHolder) fact.dependencies.push(`${targetHolder.collection}:${targetId}`)
      if (familyId) fact.dependencies.push(`families:${familyId}`)
      if (contributorId) fact.dependencies.push(`users:${contributorId}`)
      const contributionRequestId = relationId(detail.contributionRequestId)
      if (contributionRequestId) fact.dependencies.push(`contribution_requests:${contributionRequestId}`)
    }
    if (transaction.type === 'collect' || transaction.type === 'repayment') {
      const originField = transaction.type === 'collect' ? 'loanTransactionId' : 'borrowingTransactionId'
      const expectedType = transaction.type === 'collect' ? 'loan' : 'borrowing'
      const originId = relationId(detail[originField])
      const origin = transactions.get(originId)
      const originDetails = detailsForTransaction.get(originId) || []
      const originDetailInfo = originDetails.length === 1 ? originDetails[0] : null
      const originDetail = originDetailInfo?.detail || null
      const contactField = transaction.type === 'collect' ? 'borrowerId' : 'lenderId'
      const settlementContactId = relationId(detail[contactField])
      const originContactId = relationId(originDetail?.[contactField])
      const detailTimeField = transaction.type === 'collect' ? 'realCollectTime' : 'realRepaymentTime'
      const headerOccurredAt = instant(transaction.transactionTime)
      const detailOccurredAt = instant(detail[detailTimeField])
      if (!headerOccurredAt || !detailOccurredAt || headerOccurredAt !== detailOccurredAt) {
        addIssue(detailInfo.collection, detailId, 'SETTLEMENT_TIME_MISMATCH', 'BLOCKING', detailTimeField)
      }
      if (!origin || origin.type !== expectedType || safeInteger(origin.amount) !== safeInteger(transaction.amount) ||
          spaces.get(`transactions:${originId}`) !== space || !originDetail ||
          originContactId !== settlementContactId || !byId.get('contacts').has(settlementContactId) ||
          spaces.get(`contacts:${settlementContactId}`) !== space ||
          !instant(origin.transactionTime) || !detailOccurredAt || detailOccurredAt <= instant(origin.transactionTime)) {
        addIssue(detailInfo.collection, detailId, 'INVALID_DEBT_FULL_SETTLEMENT', 'BLOCKING', originField)
      }
      if (settlementOrigins.has(originId)) {
        addIssue(detailInfo.collection, detailId, 'DUPLICATE_DEBT_SETTLEMENT', 'BLOCKING', originField)
        addIssue(settlementOrigins.get(originId).collection, settlementOrigins.get(originId).legacyId, 'DUPLICATE_DEBT_SETTLEMENT', 'BLOCKING', originField)
      } else settlementOrigins.set(originId, { collection: detailInfo.collection, legacyId: detailId })
      fact.originDetailId = originDetail ? idOf(originDetail._id) : null
      fact.dependencies.push(
        `transactions:${originId}`,
        ...(originDetailInfo ? [`${originDetailInfo.collection}:${fact.originDetailId}`] : []),
        ...(settlementContactId ? [`contacts:${settlementContactId}`] : [])
      )
      fact.debtSettlement = {
        originAgreementTransactionLegacyId: originId,
        originAgreementDetailLegacyId: fact.originDetailId,
        settlementDetailLegacyId: detailId,
        contactLegacyId: settlementContactId,
        fullPrincipalAmount: safeInteger(transaction.amount),
        rate: originDetail ? validRateText(originDetail.rate) : null,
        rateBasis: 'UNSPECIFIED',
        space,
        headerOccurredAt,
        detailOccurredAt
      }
      fact.settlementOccurredAt = detailOccurredAt
    }
    fact.dependencies = sortedUnique(fact.dependencies)
    for (const dependency of fact.dependencies) addDependency(`${detailInfo.collection}:${detailId}`, dependency)
    facts.set(transactionId, fact)
  }

  for (const account of records.get('accounts')) {
    if (safeInteger(account.initBalance) !== 0 && !instant(account.createdAt)) {
      addIssue('accounts', idOf(account._id), 'INVALID_OPENING_TIME', 'BLOCKING', 'createdAt')
    }
  }
  const savingRolloverByChild = new Map()
  const savingChildren = new Map()
  for (const saving of records.get('savings_accounts')) {
    const savingId = idOf(saving._id)
    const rate = validRateText(saving.rate)
    const nonTermRate = validRateText(saving.nonTermRate)
    const source = resolveHolder(saving.moneyFromType, saving.moneyFromId, spaces.get(`savings_accounts:${savingId}`), 'savings_accounts', savingId, 'moneyFromId')
    if (source) {
      const sourceHolder = holderIndex.get(source)
      addDependency(`savings_accounts:${savingId}`, `${sourceHolder.collection}:${idOf(sourceHolder.document._id)}`)
    }
    if (!rate || !nonTermRate ||
        !Number.isSafeInteger(safeInteger(saving.term)) || safeInteger(saving.term) < 1 || !instant(saving.startDate) || !source) {
      addIssue('savings_accounts', savingId, 'INVALID_SAVING_TERMS', 'BLOCKING')
    }
    if (!SAVING_INTEREST_PAID.has(saving.interestPaid) || !SAVING_TERM_ENDED.has(saving.termEnded)) {
      addIssue('savings_accounts', savingId, 'INVALID_SAVING_ENUM', 'BLOCKING')
    }
    const targetRequired = saving.interestPaid === 'monthly' ||
      (saving.interestPaid === 'maturity' && saving.termEnded === 'roll_over_principal')
    const targetSupplied = saving.interestPaidTargetId != null || saving.interestPaidTargetType != null
    if (targetRequired || targetSupplied) {
      const target = saving.interestPaidTargetType === 'account'
        ? resolveHolder('account', saving.interestPaidTargetId, spaces.get(`savings_accounts:${savingId}`), 'savings_accounts', savingId, 'interestPaidTargetId')
        : null
      if (!target) addIssue('savings_accounts', savingId, 'INVALID_SAVING_INTEREST_TARGET', 'BLOCKING', 'interestPaidTargetId')
      if (target) {
        const targetHolder = holderIndex.get(target)
        addDependency(`savings_accounts:${savingId}`, `${targetHolder.collection}:${idOf(targetHolder.document._id)}`)
      }
    }
    const parentId = relationId(saving.parentSavingId)
    if (parentId) {
      if (!savingChildren.has(parentId)) savingChildren.set(parentId, [])
      savingChildren.get(parentId).push(savingId)
      addDependency(`savings_accounts:${savingId}`, `savings_accounts:${parentId}`)
    } else if (saving.isRolledOver === true) {
      addIssue('savings_accounts', savingId, 'INVALID_SAVING_PARENT_GRAPH', 'BLOCKING', 'parentSavingId')
    }
  }
  for (const saving of records.get('savings_accounts')) {
    const savingId = idOf(saving._id)
    const parentId = relationId(saving.parentSavingId)
    if (!parentId) continue
    const parent = byId.get('savings_accounts').get(parentId)
    const children = savingChildren.get(parentId) || []
    const principalOnly = parent?.termEnded === 'roll_over_principal'
    if (parent?.termEnded === 'roll_over_principal_and_interest') {
      addIssue('savings_accounts', savingId, 'UNSUPPORTED_SAVING_INTEREST_INFERENCE', 'BLOCKING', 'parentSavingId')
      continue
    }
    if (!parent || parentId === savingId || children.length !== 1 || saving.isRolledOver !== true ||
        parent.isClosed !== true || !principalOnly || spaces.get(`savings_accounts:${parentId}`) !== spaces.get(`savings_accounts:${savingId}`) ||
        saving.moneyFromType !== 'savings_account' || relationId(saving.moneyFromId) !== parentId ||
        safeInteger(saving.initBalance) !== safeInteger(parent.initBalance) ||
        !savingMaturityInstant(parent) || instant(saving.startDate) !== savingMaturityInstant(parent)) {
      addIssue('savings_accounts', savingId, 'INVALID_SAVING_PARENT_GRAPH', 'BLOCKING', 'parentSavingId')
      if (children.length !== 1) {
        for (const childId of children) addIssue('savings_accounts', childId, 'INVALID_SAVING_PARENT_GRAPH', 'BLOCKING', 'parentSavingId')
      }
      continue
    }
    savingRolloverByChild.set(savingId, { parentId, amount: safeInteger(saving.initBalance) })
  }
  for (const saving of records.get('savings_accounts')) {
    const savingId = idOf(saving._id)
    const seen = new Set([savingId])
    let parentId = relationId(saving.parentSavingId)
    while (parentId) {
      if (seen.has(parentId)) {
        for (const cycleId of seen) addIssue('savings_accounts', cycleId, 'INVALID_SAVING_PARENT_GRAPH', 'BLOCKING', 'parentSavingId')
        break
      }
      seen.add(parentId)
      parentId = relationId(byId.get('savings_accounts').get(parentId)?.parentSavingId)
    }
  }

  for (const budget of records.get('budgets')) {
    const budgetId = idOf(budget._id)
    const budgetIdentity = `budgets:${budgetId}`
    const budgetSpace = spaces.get(`budgets:${budgetId}`)
    if (!Array.isArray(budget.categories)) continue
    for (const [index, allocation] of budget.categories.entries()) {
      const allowedAllocationFields = new Set(['categoryId', 'categoryName', 'icon', 'childrenIds', 'parentIds', 'amount', 'repeat', 'transactionIds'])
      for (const key of Object.keys(allocation || {})) {
        if (!allowedAllocationFields.has(key)) {
          addIssue('budgets', budgetId, 'UNKNOWN_SOURCE_FIELD', 'BLOCKING',
            `categories[${index}].field_${sha256(`budgets|${budgetId}|${index}|${key}`).slice(0, 16)}`)
        }
      }
      const categoryId = relationId(allocation?.categoryId)
      if (categoryId) addDependency(budgetIdentity, `categories:${categoryId}`)
      if (!categoryId || !byId.get('categories').has(categoryId) || spaces.get(`categories:${categoryId}`) !== budgetSpace) {
        addIssue('budgets', budgetId, 'UNRESOLVED_BUDGET_CATEGORY', 'BLOCKING', `categories[${index}].categoryId`)
      }
      const numericStringAmount = typeof allocation?.amount === 'string' && /^\d+$/.test(allocation.amount) &&
        Number.isSafeInteger(Number(allocation.amount))
      const allocationAmount = numericStringAmount ? Number(allocation.amount) : safeInteger(allocation?.amount)
      if (numericStringAmount) {
        addIssue('budgets', budgetId, 'LEGACY_NUMERIC_STRING_NORMALIZED', 'REQUIRES_REVIEW', `categories[${index}].amount`)
      }
      if (allocationAmount === null || allocationAmount < 0) {
        addIssue('budgets', budgetId, 'INVALID_FINANCIAL_VALUE', 'BLOCKING', `categories[${index}].amount`)
      }
      for (const value of allocation?.transactionIds || []) {
        const related = transactions.get(idOf(value))
        if (idOf(value)) addDependency(budgetIdentity, `transactions:${idOf(value)}`)
        if (!related || spaces.get(`transactions:${idOf(value)}`) !== budgetSpace) {
          addIssue('budgets', budgetId, 'UNRESOLVED_BUDGET_TRANSACTION', 'BLOCKING', `categories[${index}].transactionIds`)
        }
      }
    }
  }

  for (const notification of records.get('notifications')) {
    const notificationId = idOf(notification._id)
    if (!NOTIFICATION_TYPE_MAP[notification.type]) addIssue('notifications', notificationId, 'INVALID_NOTIFICATION_ENUM', 'BLOCKING', 'type')
    if (notification.link !== null && notification.link !== undefined && typeof notification.link !== 'string') addIssue('notifications', notificationId, 'INVALID_NOTIFICATION_LINK', 'REQUIRES_REVIEW', 'link')
  }
  for (const recipient of records.get('user_notifications')) {
    const recipientId = idOf(recipient._id)
    const userId = relationId(recipient.userId)
    const notificationId = relationId(recipient.notificationId)
    if (userId) addDependency(`user_notifications:${recipientId}`, `users:${userId}`)
    if (notificationId) addDependency(`user_notifications:${recipientId}`, `notifications:${notificationId}`)
    if (!users.has(userId)) addIssue('user_notifications', recipientId, 'UNRESOLVED_USER_REFERENCE', 'BLOCKING', 'userId')
    if (!byId.get('notifications').has(notificationId)) addIssue('user_notifications', recipientId, 'UNRESOLVED_NOTIFICATION_REFERENCE', 'BLOCKING', 'notificationId')
    const readAt = instant(recipient.readAt)
    if ((recipient.isRead === true && !readAt) ||
        (recipient.isRead === false && recipient.readAt !== null && recipient.readAt !== undefined)) {
      addIssue('user_notifications', recipientId, 'INVALID_NOTIFICATION_READ_STATE', 'BLOCKING', 'readAt')
    }
  }

  for (const collection of SCHEMA_ONLY_COLLECTIONS) {
    for (const document of records.get(collection)) addIssue(collection, idOf(document._id), 'SCHEMA_ONLY_RECORD_DISCOVERED', 'REQUIRES_REVIEW')
  }
  for (const task of records.get('system_tasks')) addIssue('system_tasks', idOf(task._id), 'AGENDA_INTERNAL_RECORD_ARCHIVED', 'REQUIRES_REVIEW')

  const propagateRejectedDependencies = () => {
    let changed = true
    while (changed) {
      changed = false
      for (const [identity, dependencies] of dependenciesByIdentity) {
        const state = recordState.get(identity)
        if (!state || state.rejected || ARCHIVE_COLLECTIONS.has(identity.split(':')[0])) continue
        if ([...dependencies].some((dependency) => !dependencyAvailable(dependency))) {
          const separator = identity.indexOf(':')
          addIssue(identity.slice(0, separator), identity.slice(separator + 1), 'REJECTED_DEPENDENCY', 'BLOCKING')
          changed = true
        }
      }
    }
  }
  propagateRejectedDependencies()

  const userEntry = (space, holderKey, entryRole, amount) => ({
    ledgerRef: `${space}|holder:${holderKey}`, holderKey, space, entryRole,
    accountKind: 'USER_BALANCE', systemRole: null, amount
  })
  const systemEntry = (space, code, entryRole, amount) => ({
    ledgerRef: `${space}|system:${code}`, holderKey: null, space, entryRole,
    accountKind: 'SYSTEM', systemRole: code, amount
  })
  const candidatePostings = []
  const pushPosting = ({ templateCode, legacyId, occurredAt, amount, entries, sourceRefs, metadata = null, atomicGroup = null }) => {
    const completeSourceRefs = dependencyClosure(sourceRefs)
    if (completeSourceRefs.some((identity) => !dependencyAvailable(identity))) throw new Error('Posting source dependency is not available')
    const boundSourceRefs = completeSourceRefs.filter(isLoaded)
    for (const entry of entries) {
      const separator = entry.space.indexOf(':')
      const ownerIdentity = `${entry.space.slice(0, separator) === 'individual' ? 'users' : 'families'}:${entry.space.slice(separator + 1)}`
      if (!isLoaded(ownerIdentity)) throw new Error('Ledger space owner is not LOADED')
    }
    candidatePostings.push({
      templateCode,
      templateVersion: 1,
      transactionType: TEMPLATE_REGISTRY[templateCode].transactionType,
      legacyId,
      occurredAt,
      amount,
      entries,
      sourceRefs: boundSourceRefs,
      metadata,
      atomicGroup
    })
  }

  for (const account of records.get('accounts')) {
    const accountId = idOf(account._id)
    const amount = safeInteger(account.initBalance)
    if (amount === null || amount === 0 || recordState.get(`accounts:${accountId}`).rejected) continue
    const space = spaces.get(`accounts:${accountId}`)
    pushPosting({
      templateCode: 'OPENING_BALANCE', legacyId: accountId, occurredAt: instant(account.createdAt), amount,
      sourceRefs: dependencyClosure([`accounts:${accountId}`]),
      entries: [
        userEntry(space, `account:${accountId}`, 'ACCOUNT', amount),
        systemEntry(space, 'OPENING_EQUITY', 'OPENING_EQUITY', -amount)
      ]
    })
  }

  const savingTerms = []
  for (const saving of records.get('savings_accounts')) {
    const savingId = idOf(saving._id)
    const amount = safeInteger(saving.initBalance)
    const sourceKey = `${saving.moneyFromType}:${relationId(saving.moneyFromId)}`
    if (recordState.get(`savings_accounts:${savingId}`).rejected) continue
    savingTerms.push({
      legacyId: savingId,
      rate: validRateText(saving.rate),
      nonTermRate: validRateText(saving.nonTermRate),
      termMonths: safeInteger(saving.term),
      interestPaid: saving.interestPaid,
      termEnded: saving.termEnded,
      rateBasis: 'PERCENT_PER_YEAR_UNCOMPOUNDED_SOURCE_TERM'
    })
    if (!amount) continue
    const space = spaces.get(`savings_accounts:${savingId}`)
    const rollover = savingRolloverByChild.get(savingId)
    if (rollover) {
      pushPosting({
        templateCode: 'SAVING_ROLLOVER_PRINCIPAL', legacyId: savingId, occurredAt: instant(saving.startDate), amount,
        sourceRefs: dependencyClosure([`savings_accounts:${savingId}`, `savings_accounts:${rollover.parentId}`]),
        metadata: { parentSavingLegacyId: rollover.parentId, interestLedgerEffect: 0 },
        entries: [
          userEntry(space, `savings_account:${rollover.parentId}`, 'OLD_SAVING', -amount),
          userEntry(space, `savings_account:${savingId}`, 'NEW_SAVING', amount)
        ]
      })
      continue
    }
    pushPosting({
      templateCode: 'SAVING_DEPOSIT', legacyId: savingId, occurredAt: instant(saving.startDate), amount,
      sourceRefs: dependencyClosure([`savings_accounts:${savingId}`, `${holderIndex.get(sourceKey).collection}:${relationId(saving.moneyFromId)}`]),
      entries: [
        userEntry(space, sourceKey, 'SOURCE', -amount),
        userEntry(space, `savings_account:${savingId}`, 'SAVING_TARGET', amount)
      ]
    })
  }

  for (const fact of facts.values()) {
    if (recordState.get(`transactions:${fact.transactionId}`).rejected ||
        recordState.get(`${fact.detailInfo.collection}:${fact.detailId}`).rejected) continue
    const amount = safeInteger(fact.transaction.amount)
    const refs = dependencyClosure([`transactions:${fact.transactionId}`, `${fact.detailInfo.collection}:${fact.detailId}`, ...fact.dependencies])
    const base = {
      legacyId: fact.transactionId,
      occurredAt: fact.settlementOccurredAt || instant(fact.transaction.transactionTime),
      amount,
      sourceRefs: refs
    }
    if (fact.transaction.type === 'income') pushPosting({ ...base, templateCode: 'INCOME', entries: [userEntry(fact.space, fact.target, 'TARGET', amount), systemEntry(fact.space, 'INCOME_CLEARING', 'INCOME_CLEARING', -amount)] })
    if (fact.transaction.type === 'expense') pushPosting({ ...base, templateCode: 'EXPENSE', entries: [userEntry(fact.space, fact.source, 'SOURCE', -amount), systemEntry(fact.space, 'EXPENSE_CLEARING', 'EXPENSE_CLEARING', amount)] })
    if (fact.transaction.type === 'transfer') pushPosting({ ...base, templateCode: 'TRANSFER', metadata: { legacyFee: fact.detail.fee == null ? 0 : safeInteger(fact.detail.fee), feeLedgerEffect: 0 }, entries: [userEntry(fact.space, fact.source, 'SOURCE', -amount), userEntry(fact.space, fact.target, 'TARGET', amount)] })
    if (fact.transaction.type === 'loan') pushPosting({ ...base, templateCode: 'LOAN_DISBURSEMENT', metadata: fact.debt, entries: [userEntry(fact.space, fact.source, 'CASH_SOURCE', -amount), systemEntry(fact.space, 'LOAN_RECEIVABLE', 'LOAN_RECEIVABLE', amount)] })
    if (fact.transaction.type === 'borrowing') pushPosting({ ...base, templateCode: 'BORROWING', metadata: fact.debt, entries: [userEntry(fact.space, fact.target, 'CASH_TARGET', amount), systemEntry(fact.space, 'BORROWING_LIABILITY', 'BORROWING_LIABILITY', -amount)] })
    if (fact.transaction.type === 'collect') pushPosting({ ...base, templateCode: 'COLLECTION', metadata: fact.debtSettlement, entries: [userEntry(fact.space, fact.target, 'CASH_TARGET', amount), systemEntry(fact.space, 'LOAN_RECEIVABLE', 'LOAN_RECEIVABLE', -amount)] })
    if (fact.transaction.type === 'repayment') pushPosting({ ...base, templateCode: 'REPAYMENT', metadata: fact.debtSettlement, entries: [userEntry(fact.space, fact.source, 'CASH_SOURCE', -amount), systemEntry(fact.space, 'BORROWING_LIABILITY', 'BORROWING_LIABILITY', amount)] })
    if (fact.transaction.type === 'contribution') {
      const atomicGroup = `contribution:${fact.transactionId}`
      pushPosting({ ...base, templateCode: 'CONTRIBUTION_OUT', atomicGroup, entries: [userEntry(fact.sourceSpace, fact.source, 'SOURCE', -amount), systemEntry(fact.sourceSpace, 'INTERSPACE_CLEARING', 'INTERSPACE_CLEARING_OUT', amount)] })
      pushPosting({ ...base, templateCode: 'CONTRIBUTION_IN', atomicGroup, entries: [systemEntry(fact.targetSpace, 'INTERSPACE_CLEARING', 'INTERSPACE_CLEARING_IN', -amount), userEntry(fact.targetSpace, fact.target, 'TARGET', amount)] })
    }
  }

  const validateRegistry = (posting) => {
    const definition = TEMPLATE_REGISTRY[posting.templateCode]
    if (!definition || definition.version !== posting.templateVersion || definition.transactionType !== posting.transactionType) return false
    for (const entry of posting.entries) {
      const expected = definition.roles.find((item) => item.entryRole === entry.entryRole)
      if (!expected || expected.accountKind !== entry.accountKind || expected.systemRole !== entry.systemRole ||
          (expected.sign === 'POSITIVE' && entry.amount <= 0) || (expected.sign === 'NEGATIVE' && entry.amount >= 0)) return false
      if (entry.accountKind === 'SYSTEM' && !SYSTEM_ACCOUNT_REGISTRY[entry.systemRole]) return false
    }
    return definition.roles.every((expected) => {
      const count = posting.entries.filter((entry) => entry.entryRole === expected.entryRole).length
      return count >= expected.minimum && count <= expected.maximum
    }) && posting.entries.reduce((sum, entry) => sum + entry.amount, 0) === 0
  }
  for (const posting of candidatePostings) {
    if (!validateRegistry(posting)) {
      const source = posting.sourceRefs[0].split(':')
      addIssue(source[0], source.slice(1).join(':'), 'POSTING_REGISTRY_MISMATCH', 'BLOCKING')
    }
  }
  propagateRejectedDependencies()

  const sortedCandidates = candidatePostings
    .filter((posting) => posting.sourceRefs.every((identity) => !recordState.get(identity)?.rejected && !ARCHIVE_COLLECTIONS.has(identity.split(':')[0])))
    .sort((left, right) =>
      Number(right.templateCode === 'OPENING_BALANCE') - Number(left.templateCode === 'OPENING_BALANCE') ||
      left.occurredAt.localeCompare(right.occurredAt) || left.legacyId.localeCompare(right.legacyId) ||
      left.templateCode.localeCompare(right.templateCode))
  const preliminaryBalances = new Map()
  for (const posting of sortedCandidates) {
    for (const entry of posting.entries) {
      const before = preliminaryBalances.get(entry.ledgerRef) || 0
      const after = before + entry.amount
      const invalidUserAfterState = entry.accountKind === 'USER_BALANCE' && entry.amount < 0 && after < 0 &&
        posting.templateCode !== 'OPENING_BALANCE'
      const invalidSystemAfterState = entry.accountKind === 'SYSTEM' && after < 0 &&
        SYSTEM_ACCOUNT_REGISTRY[entry.systemRole]?.allowsNegativeBalance !== true
      if (invalidUserAfterState || invalidSystemAfterState) {
        const identity = posting.sourceRefs[0]
        const separator = identity.indexOf(':')
        addIssue(identity.slice(0, separator), identity.slice(separator + 1),
          invalidUserAfterState ? 'NEGATIVE_INTERMEDIATE_BALANCE' : 'SYSTEM_ACCOUNT_NEGATIVE_BALANCE', 'BLOCKING')
      }
      preliminaryBalances.set(entry.ledgerRef, after)
    }
  }
  propagateRejectedDependencies()
  const buildLedgerChain = (candidates) => {
    const state = new Map()
    const postings = candidates.map((posting) => ({
      ...posting,
      entries: posting.entries.map((entry) => {
        const previous = state.get(entry.ledgerRef) || { sequence: 0, balance: 0 }
        const next = { sequence: previous.sequence + 1, balance: previous.balance + entry.amount }
        state.set(entry.ledgerRef, next)
        return { ...entry, sequence: next.sequence, balanceBefore: previous.balance, balanceAfter: next.balance }
      })
    }))
    return { postings, state }
  }
  let finalCandidates = sortedCandidates.filter((posting) => posting.sourceRefs.every((identity) => !recordState.get(identity)?.rejected))
  let { postings: postingPlan, state: ledgerState } = buildLedgerChain(finalCandidates)

  const reconciliationEvidence = new Map()
  for (let pass = 0; pass <= holderIndex.size; pass += 1) {
    let rejectedThisPass = false
    for (const [type, collection] of Object.entries(holderCollections)) {
      for (const holder of records.get(collection)) {
        const legacyId = idOf(holder._id)
        const identity = `${collection}:${legacyId}`
        const stored = safeInteger(holder.balance)
        if (stored === null || recordState.get(identity).rejected) continue
        const space = spaces.get(identity)
        const reconstructed = ledgerState.get(`${space}|holder:${type}:${legacyId}`)?.balance || 0
        const difference = stored - reconstructed
        reconciliationEvidence.set(identity, { collection, legacyId, stored, reconstructed, difference })
        if (difference !== 0) {
          addIssue(collection, legacyId, collection === 'savings_accounts' ? 'AMBIGUOUS_SAVING_INTEREST' : 'BALANCE_MISMATCH', 'BLOCKING', 'balance')
          rejectedThisPass = true
        }
      }
    }
    if (!rejectedThisPass) break
    if (pass === holderIndex.size) throw new Error('Balance reconciliation did not converge')
    propagateRejectedDependencies()
    finalCandidates = sortedCandidates.filter((posting) => posting.sourceRefs.every((identity) =>
      !recordState.get(identity)?.rejected && !ARCHIVE_COLLECTIONS.has(identity.split(':')[0])))
    ;({ postings: postingPlan, state: ledgerState } = buildLedgerChain(finalCandidates))
  }
  const balanceReconciliation = [...reconciliationEvidence.values()]
    .sort((left, right) => left.collection.localeCompare(right.collection) || left.legacyId.localeCompare(right.legacyId))
  const systemBalances = [...ledgerState.entries()]
    .filter(([ledgerRef]) => ledgerRef.includes('|system:'))
    .map(([ledgerRef, state]) => ({ ledgerRef, balance: state.balance, sequence: state.sequence }))
    .sort((left, right) => left.ledgerRef.localeCompare(right.ledgerRef))
  const ledgerReconciliation = [...ledgerState.entries()]
    .map(([ledgerRef, state]) => ({ ledgerRef, balance: state.balance, sequence: state.sequence }))
    .sort((left, right) => left.ledgerRef.localeCompare(right.ledgerRef))

  for (const [identity, dependencies] of dependenciesByIdentity) {
    if (isLoaded(identity) && [...dependencies].some((dependency) => !dependencyAvailable(dependency))) {
      throw new Error(`Canonical target has unavailable dependency: ${identity}`)
    }
  }

  const dispositions = []
  for (const collection of DECLARED_COLLECTIONS) {
    for (const document of records.get(collection)) {
      const legacyId = idOf(document._id)
      const disposition = ARCHIVE_COLLECTIONS.has(collection)
        ? 'ARCHIVED'
        : recordState.get(`${collection}:${legacyId}`).rejected ? 'REJECTED' : 'LOADED'
      dispositions.push({ collection, legacyId, disposition })
    }
  }
  const dispositionIdentity = new Set(dispositions.map((item) => `${item.collection}:${item.legacyId}`))
  const sourceCount = [...records.values()].reduce((sum, items) => sum + items.length, 0)
  if (dispositions.length !== sourceCount || dispositionIdentity.size !== sourceCount) throw new Error('Every source record must have exactly one disposition')

  const routeSummaries = DECLARED_COLLECTIONS.map((collection) => {
    const collectionDispositions = dispositions.filter((item) => item.collection === collection)
    const sourceRoute = sanitizedManifest.sourceRoutes.find((route) => route.collection === collection)
    return {
      collection,
      sourceState: sourceRoute.state,
      sourceCount: records.get(collection).length,
      loadedCount: collectionDispositions.filter((item) => item.disposition === 'LOADED').length,
      archivedCount: collectionDispositions.filter((item) => item.disposition === 'ARCHIVED').length,
      rejectedCount: collectionDispositions.filter((item) => item.disposition === 'REJECTED').length
    }
  })

  const safeTargets = dispositions.filter((item) => item.disposition === 'LOADED').map((item) => {
    const document = byId.get(item.collection).get(item.legacyId)
    const target = { collection: item.collection, legacyId: item.legacyId }
    target.dependencyRefs = dependencyClosure([`${item.collection}:${item.legacyId}`])
      .filter((identity) => identity !== `${item.collection}:${item.legacyId}`)
      .map((identity) => ({ identity, disposition: isLoaded(identity) ? 'LOADED' : 'APPROVED_ARCHIVE' }))
    for (const key of ['ownerType', 'type', 'status']) if (typeof document[key] === 'string') target[key] = document[key]
    for (const key of ['ownerId', 'categoryId', 'transactionId', 'userId', 'notificationId']) {
      const relation = relationId(document[key])
      if (relation) target[key] = relation
    }
    for (const key of ['amount', 'initBalance', 'balance', 'targetBalance']) {
      const value = safeInteger(document[key])
      if (value !== null) target[key] = value
    }
    for (const key of ['transactionTime', 'startTime', 'endTime', 'createdAt']) {
      const value = instant(document[key])
      if (value) target[key] = value
    }
    return target
  })
  const budgetTargets = dispositions
    .filter((item) => item.collection === 'budgets' && item.disposition === 'LOADED')
    .map((item) => {
      const budget = byId.get('budgets').get(item.legacyId)
      return {
        legacyId: item.legacyId,
        space: spaces.get(`budgets:${item.legacyId}`),
        ownerType: budget.ownerType,
        ownerLegacyId: relationId(budget.ownerId),
        startAt: instant(budget.startTime),
        endAt: instant(budget.endTime),
        allocations: budget.categories.map((allocation) => ({
          categoryLegacyId: relationId(allocation.categoryId),
          amount: typeof allocation.amount === 'string' ? Number(allocation.amount) : safeInteger(allocation.amount),
          repeat: allocation.repeat === true,
          transactionLegacyIds: (allocation.transactionIds || []).map(idOf)
        }))
      }
    })
  const notificationTargets = dispositions
    .filter((item) => item.collection === 'notifications' && item.disposition === 'LOADED')
    .map((item) => {
      const notification = byId.get('notifications').get(item.legacyId)
      return {
        legacyId: item.legacyId,
        notificationType: NOTIFICATION_TYPE_MAP[notification.type],
        hasLink: typeof notification.link === 'string'
      }
    })
  const notificationRecipientTargets = dispositions
    .filter((item) => item.collection === 'user_notifications' && item.disposition === 'LOADED')
    .map((item) => {
      const recipient = byId.get('user_notifications').get(item.legacyId)
      const userLegacyId = relationId(recipient.userId)
      const notificationLegacyId = relationId(recipient.notificationId)
      const isRead = recipient.isRead === true
      const receivedAt = instant(recipient.receiveAt)
      const readAt = instant(recipient.readAt)
      if (!isLoaded(`users:${userLegacyId}`) || !isLoaded(`notifications:${notificationLegacyId}`)) {
        throw new Error('Canonical notification recipient has unavailable required FK')
      }
      if (!receivedAt || (isRead && !readAt) || (!isRead && readAt)) {
        throw new Error('Canonical notification recipient violates target read-state contract')
      }
      return {
        legacyId: item.legacyId,
        userLegacyId,
        notificationLegacyId,
        isRead,
        receivedAt,
        readAt
      }
    })
  const canonicalPlanPayload = {
    version: TRANSFORM_VERSION,
    sourceSnapshotId: sanitizedManifest.sourceSnapshotId,
    sourceEvidenceFingerprint: sanitizedManifest.evidenceFingerprint,
    routes: routeSummaries,
    dispositions,
    discrepancies: discrepancies.sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right))),
    targets: safeTargets,
    budgetTargets,
    notificationTargets,
    notificationRecipientTargets,
    systemAccountRegistry: SYSTEM_ACCOUNT_REGISTRY,
    templateRegistry: TEMPLATE_REGISTRY,
    savingTerms,
    postings: postingPlan,
    balances: balanceReconciliation,
    ledgerReconciliation,
    systemBalances
  }
  const planHash = sha256(canonicalJson(canonicalPlanPayload))
  const summary = freezeJson({
    version: TRANSFORM_VERSION,
    sourceCount,
    routeCount: routeSummaries.length,
    loadedCount: dispositions.filter((item) => item.disposition === 'LOADED').length,
    archivedCount: dispositions.filter((item) => item.disposition === 'ARCHIVED').length,
    rejectedCount: dispositions.filter((item) => item.disposition === 'REJECTED').length,
    discrepancyCount: discrepancies.length,
    blockingCount: discrepancies.filter((item) => item.severity === 'BLOCKING').length,
    unclassifiedCount: discrepancies.filter((item) => item.code === 'UNCLASSIFIED').length,
    transactionHeaderCount: records.get('transactions').length,
    detailDistribution,
    postingCount: postingPlan.length,
    postingEntryCount: postingPlan.reduce((sum, posting) => sum + posting.entries.length, 0),
    ledgerCount: ledgerState.size,
    systemLedgerCount: systemBalances.length,
    balanceHolderCount: balanceReconciliation.length,
    balanceMismatchCount: balanceReconciliation.filter((item) => item.difference !== 0).length,
    planHash
  })

  const canonicalPlan = freezeJson({ ...canonicalPlanPayload, planHash })
  const loadedIdentity = new Set(dispositions.filter((item) => item.disposition === 'LOADED').map((item) => `${item.collection}:${item.legacyId}`))
  const targetBsonByCollection = new Map(DECLARED_COLLECTIONS.map((collection) => [
    collection,
    Object.freeze(records.get(collection)
      .filter((document) => loadedIdentity.has(`${collection}:${idOf(document._id)}`))
      .map((document) => Buffer.from(BSON.serialize(document))))
  ]))
  const notificationLoaderRows = Object.freeze(notificationTargets.map((target) => {
    const notification = byId.get('notifications').get(target.legacyId)
    return Object.freeze({
      legacyId: target.legacyId,
      notificationType: target.notificationType,
      title: notification.title,
      message: notification.message,
      link: typeof notification.link === 'string' ? notification.link : null
    })
  }))
  const notificationRecipientLoaderRows = Object.freeze(notificationRecipientTargets.map((target) => Object.freeze({ ...target })))
  const getOperationalTargetPlan = () => Object.freeze({
    getLoadedDocuments(collection) {
      if (!DECLARED_COLLECTIONS.includes(collection)) throw new Error(`Unknown declared collection: ${collection}`)
      if (collection === 'budgets') return freezeJson(budgetTargets)
      if (collection === 'notifications') return Object.freeze(notificationLoaderRows.map((row) => Object.freeze({ ...row })))
      if (collection === 'user_notifications') return Object.freeze(notificationRecipientLoaderRows.map((row) => Object.freeze({ ...row })))
      return Object.freeze(targetBsonByCollection.get(collection).map((bytes) => BSON.deserialize(Buffer.from(bytes), {
        promoteLongs: false,
        promoteValues: false,
        promoteBuffers: false,
        validation: { utf8: true }
      })))
    },
    postingPlan: freezeJson(postingPlan)
  })

  return Object.freeze({ summary, canonicalPlan, getOperationalTargetPlan })
}

module.exports = {
  ARCHIVE_COLLECTIONS,
  SYSTEM_ACCOUNT_REGISTRY,
  TEMPLATE_REGISTRY,
  TRANSFORM_VERSION,
  buildWave2TransformPlan
}
