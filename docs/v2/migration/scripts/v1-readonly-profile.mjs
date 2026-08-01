import 'dotenv/config'
import { MongoClient } from 'mongodb'

const mode = process.env.BUILD_MODE === 'production' ? 'production' : 'development'
const uri = mode === 'production'
  ? process.env.MONGODB_URI_PRODUCTION_READONLY
  : process.env.MONGODB_URI_DEVELOPMENT_READONLY
const databaseName = process.env.DATABASE_NAME

if (!uri || !databaseName) throw new Error('Missing MongoDB profile configuration')

const client = new MongoClient(uri, {
  appName: 'wave0-readonly-profile',
  connectTimeoutMS: 10000,
  serverSelectionTimeoutMS: 10000,
  readPreference: 'secondaryPreferred',
  retryWrites: false
})

const detailCollections = [
  'expenses',
  'incomes',
  'transfers',
  'loans',
  'borrowings',
  'repayments',
  'collections',
  'contributions'
]

const sourceCollections = [
  'users', 'families', 'banks', 'categories', 'money_sources', 'accounts',
  'accumulations', 'savings_accounts', 'transactions', 'expenses', 'incomes',
  'transfers', 'contributions', 'loans', 'borrowings', 'collections',
  'repayments', 'contacts', 'budgets', 'notifications', 'user_notifications',
  'contribution_requests', 'group_payouts', 'invitations', 'proposal_expenses',
  'system_tasks'
]

const requiredFields = {
  users: ['email', 'password', 'username', 'displayName'],
  families: ['familyName', 'ownerId'],
  banks: ['code', 'name'],
  categories: ['ownerType', 'ownerId', 'name', 'type'],
  money_sources: ['ownerType', 'ownerId'],
  accounts: ['ownerType', 'moneySourceId', 'type', 'accountName', 'initBalance', 'balance'],
  accumulations: ['ownerType', 'moneySourceId', 'accumulationName', 'targetBalance', 'startDate', 'endDate'],
  savings_accounts: ['ownerType', 'moneySourceId', 'savingsAccountName', 'bankId', 'initBalance', 'balance', 'rate', 'nonTermRate', 'startDate', 'interestPaid', 'termEnded', 'moneyFromType', 'moneyFromId'],
  transactions: ['ownerType', 'ownerId', 'responsiblePersonId', 'type', 'categoryId', 'name', 'amount', 'transactionTime'],
  expenses: ['transactionId', 'moneyFromType', 'moneyFromId'],
  incomes: ['transactionId', 'moneyTargetType', 'moneyTargetId'],
  transfers: ['transactionId', 'moneyFromType', 'moneyFromId', 'moneyTargetType', 'moneyTargetId'],
  contributions: ['transactionId', 'recipientId', 'moneyFromType', 'moneyFromId', 'moneyTargetType', 'moneyTargetId'],
  loans: ['transactionId', 'moneyFromType', 'moneyFromId', 'borrowerId', 'rate'],
  borrowings: ['transactionId', 'moneyTargetType', 'moneyTargetId', 'lenderId', 'rate'],
  collections: ['transactionId', 'loanTransactionId', 'borrowerId', 'moneyTargetType', 'moneyTargetId', 'realCollectTime'],
  repayments: ['transactionId', 'borrowingTransactionId', 'lenderId', 'moneyFromType', 'moneyFromId', 'realRepaymentTime'],
  contacts: ['ownerType', 'ownerId', 'name'],
  budgets: ['ownerType', 'ownerId', 'startTime', 'endTime'],
  notifications: ['title', 'message', 'type'],
  user_notifications: ['userId', 'notificationId'],
  contribution_requests: ['ownerType', 'ownerId', 'familyId', 'name', 'amount', 'moneyTargetType', 'moneyTargetId', 'deadline', 'contributerIds'],
  group_payouts: ['transactionId', 'recipientId', 'moneyFromType', 'moneyFromId', 'moneyTargetType', 'moneyTargetId'],
  invitations: ['inviterId', 'inviteeId', 'familyId', 'status'],
  proposal_expenses: ['ownerType', 'ownerId', 'targetId', 'name', 'amount', 'categoryId', 'status'],
  system_tasks: [] // Agenda owns the live collection shape; profile separately below.
}

const enumFields = {
  users: { currency: ['VND'], language: ['Tiếng Việt'] },
  categories: { ownerType: ['individual', 'family'], type: ['expense', 'income', 'loan', 'collect', 'borrowing', 'repayment', 'transfer', 'contribution'] },
  money_sources: { ownerType: ['individual', 'family'] },
  accounts: { ownerType: ['individual', 'family'], type: ['wallet', 'bank', 'orther'] },
  accumulations: { ownerType: ['individual', 'family'] },
  savings_accounts: { ownerType: ['individual', 'family'], interestPaid: ['maturity', 'monthly'], termEnded: ['roll_over_principal_and_interest', 'roll_over_principal', 'close_account'], moneyFromType: ['account', 'savings_account', 'accumulation'] },
  transactions: { ownerType: ['individual', 'family'], type: ['expense', 'income', 'loan', 'collect', 'borrowing', 'repayment', 'transfer', 'contribution'] },
  expenses: { moneyFromType: ['account', 'savings_account', 'accumulation'] },
  incomes: { moneyTargetType: ['account', 'savings_account', 'accumulation'] },
  transfers: { moneyFromType: ['account', 'savings_account', 'accumulation'], moneyTargetType: ['account', 'savings_account', 'accumulation'] },
  contributions: { moneyFromType: ['account', 'savings_account', 'accumulation'], moneyTargetType: ['account', 'savings_account', 'accumulation'] },
  loans: { moneyFromType: ['account', 'savings_account', 'accumulation'] },
  borrowings: { moneyTargetType: ['account', 'savings_account', 'accumulation'] },
  collections: { moneyTargetType: ['account', 'savings_account', 'accumulation'] },
  repayments: { moneyFromType: ['account', 'savings_account', 'accumulation'] },
  contacts: { ownerType: ['individual', 'family'], trustLevel: ['normal', 'good', 'warning', 'bad'] },
  budgets: { ownerType: ['individual', 'family'] },
  notifications: { type: ['link', 'text', 'invitation'] },
  contribution_requests: { ownerType: ['individual', 'family'], moneyTargetType: ['account', 'savings_account', 'accumulation'] },
  invitations: { status: ['waiting', 'accepted', 'rejected'] },
  proposal_expenses: { ownerType: ['individual', 'family'], status: ['waiting', 'approved', 'rejected'] }
}

const timestampFields = {
  users: ['remindTime', 'createdAt', 'updatedAt'], families: ['createdAt', 'updatedAt'],
  banks: ['createdAt', 'updatedAt'], categories: ['createdAt', 'updatedAt'],
  money_sources: ['createdAt', 'updatedAt'], accounts: ['createdAt', 'updatedAt'],
  accumulations: ['startDate', 'endDate', 'createdAt', 'updatedAt'],
  savings_accounts: ['startDate', 'createdAt', 'updatedAt'],
  transactions: ['transactionTime', 'createdAt', 'updatedAt'],
  expenses: ['createdAt', 'updatedAt'], incomes: ['createdAt', 'updatedAt'],
  transfers: ['createdAt', 'updatedAt'], contributions: ['createdAt', 'updatedAt'],
  loans: ['collectTime', 'createdAt', 'updatedAt'], borrowings: ['repaymentTime', 'createdAt', 'updatedAt'],
  collections: ['realCollectTime', 'createdAt', 'updatedAt'], repayments: ['realRepaymentTime', 'createdAt', 'updatedAt'],
  contacts: ['createdAt', 'updatedAt'], budgets: ['startTime', 'endTime', 'createdAt', 'updatedAt'],
  notifications: ['createdAt', 'updatedAt'], user_notifications: ['readAt', 'receiveAt'],
  contribution_requests: ['deadline', 'createdAt', 'updatedAt'], group_payouts: ['createdAt', 'updatedAt'],
  invitations: ['createdAt', 'updatedAt'], proposal_expenses: ['reviewed_at', 'createdAt', 'updatedAt']
}

const arrayFields = {
  families: ['managerIds', 'memberIds'], categories: ['childrenIds', 'parentIds'],
  money_sources: ['accountIds', 'savings_accountIds', 'accumulationIds'],
  accounts: ['transactionIds'], accumulations: ['transactionIds'], savings_accounts: ['transactionIds'],
  expenses: ['images'], incomes: ['images'], transfers: ['images'], contributions: ['images'],
  loans: ['images'], borrowings: ['images'], collections: ['images'], repayments: ['images'],
  contribution_requests: ['contributerIds'], group_payouts: ['images'], proposal_expenses: ['images']
}

const knownAgendaNames = new Set(['send_reminder', 'monthly_saving_solver', 'maturity_saving_solver', 'receive_interest'])

const id = value => value == null ? null : value.toString()
const isActive = document => document?._destroy !== true

const integer = value => {
  if (typeof value === 'bigint') return value
  const normalized = value?.toString?.() ?? String(value)
  if (!/^-?\d+$/.test(normalized)) return null
  return BigInt(normalized)
}

const addDelta = (deltas, sourceType, sourceId, amount) => {
  if (!sourceType || !sourceId || amount == null) return
  const key = `${sourceType}:${id(sourceId)}`
  deltas.set(key, (deltas.get(key) ?? 0n) + amount)
}

const bsonType = value => {
  if (value == null) return value === null ? 'null' : 'missing'
  if (value?._bsontype) return value._bsontype
  if (value instanceof Date) return 'date'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

const duplicateSummary = (documents, keySelector) => {
  const groups = new Map()
  for (const document of documents.filter(isActive)) {
    const key = keySelector(document)
    if (key == null || key.includes?.('<missing>')) continue
    groups.set(key, (groups.get(key) ?? 0) + 1)
  }
  const duplicates = [...groups.entries()].filter(([, count]) => count > 1)
  return {
    duplicateKeys: duplicates.length,
    recordsInDuplicateGroups: duplicates.reduce((sum, [, count]) => sum + count, 0),
    examples: duplicates.slice(0, 5).map(([key, count]) => ({ key, count }))
  }
}

const summarizeRequiredFields = documentsByCollection => {
  let documentsWithIssues = 0
  let missing = 0
  let explicitNull = 0
  const byCollection = {}
  const examples = []
  for (const [collection, fields] of Object.entries(requiredFields)) {
    const collectionResult = { records: 0, documentsWithIssues: 0, missing: 0, explicitNull: 0 }
    for (const document of documentsByCollection[collection].filter(isActive)) {
      collectionResult.records++
      const missingFields = fields.filter(field => !Object.hasOwn(document, field))
      const nullFields = fields.filter(field => Object.hasOwn(document, field) && document[field] === null)
      if (missingFields.length || nullFields.length) {
        documentsWithIssues++
        collectionResult.documentsWithIssues++
        missing += missingFields.length
        explicitNull += nullFields.length
        collectionResult.missing += missingFields.length
        collectionResult.explicitNull += nullFields.length
        if (examples.length < 5) examples.push({ collection, sourceId: id(document._id), missingFields, nullFields })
      }
    }
    byCollection[collection] = collectionResult
  }
  return { documentsWithIssues, missing, explicitNull, byCollection, examples }
}

const summarizeEnums = documentsByCollection => {
  let invalid = 0
  const byPath = {}
  const observed = {}
  const examples = []
  for (const [collection, fields] of Object.entries(enumFields)) {
    for (const [field, allowed] of Object.entries(fields)) {
      const key = `${collection}.${field}`
      byPath[key] = 0
      observed[key] = {}
      for (const document of documentsByCollection[collection].filter(isActive)) {
        if (document[field] == null) continue
        const valueKey = String(document[field])
        observed[key][valueKey] = (observed[key][valueKey] ?? 0) + 1
        if (!allowed.includes(document[field])) {
          invalid++
          byPath[key]++
          if (examples.length < 5) examples.push({ collection, sourceId: id(document._id), field, value: String(document[field]) })
        }
      }
    }
  }
  return { invalid, byPath, observed, examples }
}

const isValidTime = value => value instanceof Date
  ? !Number.isNaN(value.getTime())
  : (typeof value === 'number' ? Number.isFinite(value) && !Number.isNaN(new Date(value).getTime()) : !Number.isNaN(Date.parse(value)))

const summarizeTimestamps = documentsByCollection => {
  let invalid = 0
  let stringsWithoutOffset = 0
  let utcDayDiffersFromHoChiMinh = 0
  const byPath = {}
  const bsonTypesByPath = {}
  const examples = []
  for (const [collection, fields] of Object.entries(timestampFields)) {
    for (const field of fields) {
      const key = `${collection}.${field}`
      byPath[key] = 0
      bsonTypesByPath[key] = {}
      for (const document of documentsByCollection[collection].filter(isActive)) {
        if (document[field] == null) continue
        const type = bsonType(document[field])
        bsonTypesByPath[key][type] = (bsonTypesByPath[key][type] ?? 0) + 1
        if (typeof document[field] === 'string' && !/(Z|[+-]\d{2}:?\d{2})$/i.test(document[field])) stringsWithoutOffset++
        if (!isValidTime(document[field])) {
          invalid++
          byPath[key]++
          if (examples.length < 5) examples.push({ collection, sourceId: id(document._id), field, bsonType: bsonType(document[field]) })
        } else {
          const value = new Date(document[field])
          const utcDay = value.toISOString().slice(0, 10)
          const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value).map(part => [part.type, part.value]))
          const hoChiMinhDay = `${parts.year}-${parts.month}-${parts.day}`
          if (utcDay !== hoChiMinhDay) utcDayDiffersFromHoChiMinh++
        }
      }
    }
  }
  return { invalid, stringsWithoutOffset, utcDayDiffersFromHoChiMinh, userIanaTimezoneMissing: documentsByCollection.users.filter(document => isActive(document) && document.timezone == null).length, byPath, bsonTypesByPath, examples }
}

const summarizeArrays = documentsByCollection => {
  let invalidType = 0
  let duplicateValues = 0
  const byPath = {}
  const examples = []
  for (const [collection, fields] of Object.entries(arrayFields)) {
    for (const field of fields) {
      const key = `${collection}.${field}`
      byPath[key] = { invalidType: 0, duplicateValues: 0 }
      for (const document of documentsByCollection[collection].filter(isActive)) {
        const value = document[field]
        if (value == null) continue
        if (!Array.isArray(value)) {
          invalidType++
          byPath[key].invalidType++
          if (examples.length < 5) examples.push({ collection, sourceId: id(document._id), field, issue: 'invalid-array-type' })
          continue
        }
        const normalized = value.map(id)
        const duplicateCount = normalized.length - new Set(normalized).size
        duplicateValues += duplicateCount
        byPath[key].duplicateValues += duplicateCount
        if (duplicateCount && examples.length < 5) examples.push({ collection, sourceId: id(document._id), field, issue: 'duplicate-array-values', duplicateCount })
      }
    }
  }
  return { invalidType, duplicateValues, byPath, examples }
}

const summarizeMoney = documentsByCollection => {
  const specs = {
    accounts: ['initBalance', 'balance'], accumulations: ['balance', 'targetBalance'],
    savings_accounts: ['initBalance', 'balance'], transactions: ['amount'],
    contribution_requests: ['amount'], proposal_expenses: ['amount']
  }
  let invalidInteger = 0
  let unsafeInteger = 0
  let invalidRate = 0
  const examples = []
  for (const [collection, fields] of Object.entries(specs)) {
    for (const document of documentsByCollection[collection].filter(isActive)) {
      for (const field of fields) {
        if (document[field] == null) continue
        if (integer(document[field]) == null) {
          invalidInteger++
          if (examples.length < 5) examples.push({ collection, sourceId: id(document._id), field, issue: 'non-integer' })
        } else if (typeof document[field] === 'number' && !Number.isSafeInteger(document[field])) {
          unsafeInteger++
          if (examples.length < 5) examples.push({ collection, sourceId: id(document._id), field, issue: 'unsafe-integer' })
        }
      }
    }
  }
  for (const collection of ['loans', 'borrowings', 'savings_accounts']) {
    for (const document of documentsByCollection[collection].filter(isActive)) {
      for (const field of ['rate', 'nonTermRate']) {
        if (document[field] == null) continue
        if (typeof document[field] !== 'number' || !Number.isFinite(document[field])) {
          invalidRate++
          if (examples.length < 5) examples.push({ collection, sourceId: id(document._id), field, issue: 'invalid-rate' })
        }
      }
    }
  }
  for (const budget of documentsByCollection.budgets.filter(isActive)) {
    for (const [index, category] of (Array.isArray(budget.categories) ? budget.categories : []).entries()) {
      if (integer(category?.amount) == null) {
        invalidInteger++
        if (examples.length < 5) examples.push({ collection: 'budgets', sourceId: id(budget._id), field: `categories[${index}].amount`, issue: 'non-integer' })
      }
    }
  }
  return { invalidInteger, unsafeInteger, invalidRate, examples }
}

const summarizeAssets = documentsByCollection => {
  const values = []
  const byPath = {}
  const addValue = (collection, document, field, value) => {
    if (typeof value === 'string' && value.trim()) {
      values.push({ collection, sourceId: id(document._id), field, value: value.trim() })
      const key = `${collection}.${field}`
      byPath[key] = (byPath[key] ?? 0) + 1
    }
  }
  for (const user of documentsByCollection.users.filter(isActive)) addValue('users', user, 'avatar', user.avatar)
  for (const family of documentsByCollection.families.filter(isActive)) addValue('families', family, 'backgroundImage', family.backgroundImage)
  for (const bank of documentsByCollection.banks.filter(isActive)) addValue('banks', bank, 'logo', bank.logo)
  for (const collection of [...detailCollections, 'group_payouts', 'proposal_expenses']) {
    for (const document of documentsByCollection[collection].filter(isActive)) {
      for (const value of (Array.isArray(document.images) ? document.images : [])) addValue(collection, document, 'images', value)
    }
  }
  const invalid = values.filter(item => { try { const url = new URL(item.value); return !['http:', 'https:'].includes(url.protocol) } catch { return true } })
  const groups = new Map()
  for (const item of values) groups.set(item.value, (groups.get(item.value) ?? 0) + 1)
  const duplicates = [...groups.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0)
  const cloudinaryReferences = values.filter(item => /(^|\.)cloudinary\.com$/i.test((() => { try { return new URL(item.value).hostname } catch { return '' } })())).length
  return {
    references: values.length,
    byPath,
    cloudinaryReferences,
    nonCloudinaryReferences: values.length - cloudinaryReferences,
    invalidUrls: invalid.length,
    duplicateReferences: duplicates,
    providerExistenceChecked: cloudinaryReferences === 0,
    examples: invalid.slice(0, 5).map(({ collection, sourceId, field }) => ({ collection, sourceId, field }))
  }
}

const summarizeAgenda = documents => {
  const now = Date.now()
  const active = documents.filter(document => document.disabled !== true)
  const signatures = new Map()
  for (const document of active) {
    const data = document.data ?? {}
    const signature = [document.name, id(data.userId), id(data.savingId), id(data.accumulationId), id(data.loanId), id(data.borrowingId), data.jobType].join(':')
    signatures.set(signature, (signatures.get(signature) ?? 0) + 1)
  }
  const duplicateGroups = [...signatures.entries()].filter(([, count]) => count > 1)
  const unknown = active.filter(document => !knownAgendaNames.has(document.name))
  const staleLocks = active.filter(document => document.lockedAt && now - new Date(document.lockedAt).getTime() > 30 * 60 * 1000)
  const unversioned = active.filter(document => document.data?.schemaVersion == null)
  const distribution = selector => active.reduce((result, document) => {
    const value = selector(document) ?? '<missing>'
    result[value] = (result[value] ?? 0) + 1
    return result
  }, {})
  return {
    total: documents.length,
    active: active.length,
    disabled: documents.length - active.length,
    repeating: active.filter(document => document.repeatInterval != null).length,
    pending: active.filter(document => document.nextRunAt != null).length,
    locked: active.filter(document => document.lockedAt != null).length,
    locksOlderThan30Minutes: staleLocks.length,
    failed: active.filter(document => document.failReason != null).length,
    unversionedPayloads: unversioned.length,
    unknownNames: unknown.length,
    duplicateStableSignatureGroups: duplicateGroups.length,
    byName: distribution(document => document.name),
    byJobType: distribution(document => document.data?.jobType),
    payloadReferenceCounts: Object.fromEntries(['userId', 'savingId', 'accumulationId', 'loanId', 'borrowingId'].map(field => [field, active.filter(document => document.data?.[field] != null).length])),
    examples: [
      ...unknown.slice(0, 2).map(document => ({ legacyMongoId: id(document._id), issue: 'unknown-name', name: document.name })),
      ...staleLocks.slice(0, 2).map(document => ({ legacyMongoId: id(document._id), issue: 'lock-older-than-30m', name: document.name })),
      ...unversioned.slice(0, 5).map(document => ({ legacyMongoId: id(document._id), issue: 'unversioned-payload', name: document.name }))
    ].slice(0, 5)
  }
}

const summarizeMoneyReferenceOrphans = (details, accounts, accumulations, savings) => {
  const targets = {
    account: new Set(accounts.filter(isActive).map(document => id(document._id))),
    accumulation: new Set(accumulations.filter(isActive).map(document => id(document._id))),
    savings_account: new Set(savings.filter(isActive).map(document => id(document._id)))
  }
  let references = 0
  let missing = 0
  let invalidType = 0
  const examples = []
  for (const [collection, documents] of Object.entries(details)) {
    for (const document of documents.filter(isActive)) {
      for (const [typeField, idField] of [['moneyFromType', 'moneyFromId'], ['moneyTargetType', 'moneyTargetId']]) {
        if (document[idField] == null) continue
        references++
        const targetSet = targets[document[typeField]]
        if (!targetSet) {
          invalidType++
          if (examples.length < 5) examples.push({ collection, sourceId: id(document._id), field: idField, issue: 'invalid-money-source-type' })
        } else if (!targetSet.has(id(document[idField]))) {
          missing++
          if (examples.length < 5) examples.push({ collection, sourceId: id(document._id), field: idField, targetId: id(document[idField]), issue: 'missing-money-source' })
        }
      }
    }
  }
  return { references, missing, invalidType, examples }
}

const summarizeCategoryGraph = (categories, categoryIds) => {
  const byId = new Map(categories.filter(isActive).map(category => [id(category._id), category]))
  let orphanEdges = 0
  let selfEdges = 0
  let asymmetricEdges = 0
  const examples = []
  for (const category of categories.filter(isActive)) {
    const sourceId = id(category._id)
    for (const [field, reverseField] of [['childrenIds', 'parentIds'], ['parentIds', 'childrenIds']]) {
      for (const targetValue of (Array.isArray(category[field]) ? category[field] : [])) {
        const targetId = id(targetValue)
        if (!categoryIds.has(targetId)) {
          orphanEdges++
          if (examples.length < 5) examples.push({ sourceId, field, targetId, issue: 'orphan-edge' })
        } else if (sourceId === targetId) {
          selfEdges++
          if (examples.length < 5) examples.push({ sourceId, field, targetId, issue: 'self-edge' })
        } else {
          const reverseValues = Array.isArray(byId.get(targetId)?.[reverseField]) ? byId.get(targetId)[reverseField].map(id) : []
          if (!reverseValues.includes(sourceId)) {
            asymmetricEdges++
            if (examples.length < 5) examples.push({ sourceId, field, targetId, issue: 'asymmetric-edge' })
          }
        }
      }
    }
  }
  return { orphanEdges, selfEdges, asymmetricEdges, examples }
}

const summarizeBudgetEmbeddedRelations = (budgets, categoryIds, transactionIds) => {
  let allocations = 0
  let orphanCategoryReferences = 0
  let orphanTransactionReferences = 0
  let invalidEmbeddedShape = 0
  const examples = []
  for (const budget of budgets.filter(isActive)) {
    if (budget.categories != null && !Array.isArray(budget.categories)) {
      invalidEmbeddedShape++
      if (examples.length < 5) examples.push({ sourceId: id(budget._id), issue: 'categories-not-array' })
      continue
    }
    for (const [index, allocation] of (budget.categories ?? []).entries()) {
      allocations++
      for (const [field, targets] of [['categoryId', categoryIds], ['childrenIds', categoryIds], ['parentIds', categoryIds], ['transactionIds', transactionIds]]) {
        const values = Array.isArray(allocation?.[field]) ? allocation[field] : [allocation?.[field]]
        for (const value of values) {
          if (value == null) continue
          if (!targets.has(id(value))) {
            if (field === 'transactionIds') orphanTransactionReferences++
            else orphanCategoryReferences++
            if (examples.length < 5) examples.push({ sourceId: id(budget._id), allocationIndex: index, field, targetId: id(value) })
          }
        }
      }
    }
  }
  return { allocations, invalidEmbeddedShape, orphanCategoryReferences, orphanTransactionReferences, examples }
}

const summarizeReverseLinks = (moneySources, accounts, accumulations, savings) => {
  const childGroups = [
    ['accountIds', accounts],
    ['accumulationIds', accumulations],
    ['savings_accountIds', savings]
  ]
  const parentById = new Map(moneySources.filter(isActive).map(source => [id(source._id), source]))
  let missingFromParentArray = 0
  let wrongParentArrayEntry = 0
  const examples = []
  for (const [arrayField, children] of childGroups) {
    const childById = new Map(children.filter(isActive).map(child => [id(child._id), child]))
    for (const child of children.filter(isActive)) {
      const parent = parentById.get(id(child.moneySourceId))
      const parentValues = Array.isArray(parent?.[arrayField]) ? parent[arrayField].map(id) : []
      if (parent && !parentValues.includes(id(child._id))) {
        missingFromParentArray++
        if (examples.length < 5) examples.push({ childId: id(child._id), parentId: id(child.moneySourceId), arrayField, issue: 'missing-reverse-entry' })
      }
    }
    for (const parent of moneySources.filter(isActive)) {
      for (const childValue of (Array.isArray(parent[arrayField]) ? parent[arrayField] : [])) {
        const child = childById.get(id(childValue))
        if (!child || id(child.moneySourceId) !== id(parent._id)) {
          wrongParentArrayEntry++
          if (examples.length < 5) examples.push({ childId: id(childValue), parentId: id(parent._id), arrayField, issue: 'wrong-or-orphan-reverse-entry' })
        }
      }
    }
  }
  return { missingFromParentArray, wrongParentArrayEntry, examples }
}

const summarizeHeaderDetailIntegrity = (transactions, details) => {
  const typeCollection = { expense: 'expenses', income: 'incomes', transfer: 'transfers', loan: 'loans', borrowing: 'borrowings', repayment: 'repayments', collect: 'collections', contribution: 'contributions' }
  const detailIds = Object.fromEntries(Object.entries(details).map(([name, documents]) => [name, new Set(documents.filter(isActive).map(document => id(document.transactionId)))]))
  let missingExpectedDetail = 0
  let unknownTransactionType = 0
  const examples = []
  for (const transaction of transactions.filter(isActive)) {
    const collection = typeCollection[transaction.type]
    if (!collection) {
      unknownTransactionType++
      if (examples.length < 5) examples.push({ transactionId: id(transaction._id), type: transaction.type, issue: 'unknown-type' })
    } else if (!detailIds[collection].has(id(transaction._id))) {
      missingExpectedDetail++
      if (examples.length < 5) examples.push({ transactionId: id(transaction._id), type: transaction.type, issue: 'missing-expected-detail' })
    }
  }
  return { missingExpectedDetail, unknownTransactionType, examples }
}

const countOrphans = (documents, field, targetIds, { array = false } = {}) => {
  let references = 0
  let missing = 0
  const examples = []
  for (const document of documents.filter(isActive)) {
    const rawValues = array ? (Array.isArray(document[field]) ? document[field] : []) : [document[field]]
    for (const value of rawValues) {
      if (value == null) continue
      references++
      if (!targetIds.has(id(value))) {
        missing++
        if (examples.length < 5) examples.push({ sourceId: id(document._id), field, targetId: id(value) })
      }
    }
  }
  return { references, missing, examples }
}

const summarizeBalances = (documents, sourceType, baseSelector, deltas) => {
  let storedTotal = 0n
  let reconstructedTotal = 0n
  let matched = 0
  let mismatched = 0
  let invalidMoney = 0
  let negativeStored = 0
  let maxAbsDifference = 0n
  const mismatchExamples = []

  for (const document of documents.filter(isActive)) {
    const stored = integer(document.balance)
    const base = baseSelector(document)
    if (stored == null || base == null) {
      invalidMoney++
      continue
    }
    const reconstructed = base + (deltas.get(`${sourceType}:${id(document._id)}`) ?? 0n)
    const difference = stored - reconstructed
    const absDifference = difference < 0n ? -difference : difference
    storedTotal += stored
    reconstructedTotal += reconstructed
    if (stored < 0n) negativeStored++
    if (difference === 0n) matched++
    else {
      mismatched++
      if (absDifference > maxAbsDifference) maxAbsDifference = absDifference
      if (mismatchExamples.length < 5) {
        mismatchExamples.push({
          legacyMongoId: id(document._id),
          stored: stored.toString(),
          reconstructed: reconstructed.toString(),
          difference: difference.toString()
        })
      }
    }
  }

  return {
    activeRecords: documents.filter(isActive).length,
    matched,
    mismatched,
    invalidMoney,
    negativeStored,
    storedTotal: storedTotal.toString(),
    reconstructedTotal: reconstructedTotal.toString(),
    totalDifference: (storedTotal - reconstructedTotal).toString(),
    maxAbsDifference: maxAbsDifference.toString(),
    mismatchExamples
  }
}

try {
  await client.connect()
  const db = client.db(databaseName)
  const collectionInfos = await db.listCollections({}, { nameOnly: true }).toArray()
  const collectionNames = collectionInfos.map(item => item.name).sort()

  const counts = {}
  for (const name of collectionNames) counts[name] = await db.collection(name).countDocuments({})

  const documentsByCollection = {}
  for (const name of sourceCollections) documentsByCollection[name] = await db.collection(name).find({}).toArray()

  const indexes = {}
  for (const name of collectionNames) {
    const collectionIndexes = await db.collection(name).listIndexes().toArray()
    indexes[name] = collectionIndexes.map(index => ({ name: index.name, key: index.key, unique: index.unique === true }))
  }

  const transactions = documentsByCollection.transactions
  const transactionById = new Map(transactions.map(transaction => [id(transaction._id), transaction]))
  const details = {}
  const deltas = new Map()
  const detailStats = {}

  for (const name of detailCollections) {
    details[name] = documentsByCollection[name]
    let active = 0
    let orphanHeader = 0
    let invalidAmount = 0

    for (const detail of details[name]) {
      if (!isActive(detail)) continue
      active++
      const header = transactionById.get(id(detail.transactionId))
      if (!header || !isActive(header)) {
        orphanHeader++
        continue
      }
      const amount = integer(header.amount)
      if (amount == null) {
        invalidAmount++
        continue
      }
      addDelta(deltas, detail.moneyFromType, detail.moneyFromId, -amount)
      addDelta(deltas, detail.moneyTargetType, detail.moneyTargetId, amount)
    }
    detailStats[name] = { total: details[name].length, active, orphanHeader, invalidAmount }
  }

  const accounts = documentsByCollection.accounts
  const accumulations = documentsByCollection.accumulations
  const savings = documentsByCollection.savings_accounts
  const users = documentsByCollection.users
  const families = documentsByCollection.families
  const banks = documentsByCollection.banks
  const categories = documentsByCollection.categories
  const moneySources = documentsByCollection.money_sources
  const contacts = documentsByCollection.contacts
  const notifications = documentsByCollection.notifications
  const userNotifications = documentsByCollection.user_notifications

  const activeIds = documents => new Set(documents.filter(isActive).map(document => id(document._id)))
  const userIds = activeIds(users)
  const familyIds = activeIds(families)
  const bankIds = activeIds(banks)
  const categoryIds = activeIds(categories)
  const moneySourceIds = activeIds(moneySources)
  const transactionIds = activeIds(transactions)
  const contactIds = activeIds(contacts)
  const notificationIds = activeIds(notifications)

  const ownerOrphans = documents => {
    let references = 0
    let missing = 0
    const examples = []
    for (const document of documents.filter(isActive)) {
      if (document.ownerId == null) continue
      references++
      const targets = document.ownerType === 'individual' ? userIds : document.ownerType === 'family' ? familyIds : null
      if (!targets || !targets.has(id(document.ownerId))) {
        missing++
        if (examples.length < 5) examples.push({ sourceId: id(document._id), ownerType: document.ownerType, ownerId: id(document.ownerId) })
      }
    }
    return { references, missing, examples }
  }

  const detailTransactionDuplicates = Object.fromEntries(detailCollections.map(name => [
    name,
    duplicateSummary(details[name], document => id(document.transactionId) ?? '<missing>')
  ]))

  const relationChecks = {
    familiesOwner: countOrphans(families, 'ownerId', userIds),
    familiesManagers: countOrphans(families, 'managerIds', userIds, { array: true }),
    familiesMembers: countOrphans(families, 'memberIds', userIds, { array: true }),
    accountsOwner: ownerOrphans(accounts),
    accountsMoneySource: countOrphans(accounts, 'moneySourceId', moneySourceIds),
    accountsBank: countOrphans(accounts, 'bankId', bankIds),
    accumulationsOwner: ownerOrphans(accumulations),
    accumulationsMoneySource: countOrphans(accumulations, 'moneySourceId', moneySourceIds),
    categoriesOwner: ownerOrphans(categories),
    moneySourcesOwner: ownerOrphans(moneySources),
    contactsOwner: ownerOrphans(contacts),
    budgetsOwner: ownerOrphans(documentsByCollection.budgets),
    contributionRequestsOwner: ownerOrphans(documentsByCollection.contribution_requests),
    proposalExpensesOwner: ownerOrphans(documentsByCollection.proposal_expenses),
    savingsOwner: ownerOrphans(savings),
    savingsMoneySource: countOrphans(savings, 'moneySourceId', moneySourceIds),
    savingsBank: countOrphans(savings, 'bankId', bankIds),
    transactionsOwner: ownerOrphans(transactions),
    transactionsCategory: countOrphans(transactions, 'categoryId', categoryIds),
    transactionsResponsiblePerson: countOrphans(transactions, 'responsiblePersonId', userIds),
    userNotificationsUser: countOrphans(userNotifications, 'userId', userIds),
    userNotificationsNotification: countOrphans(userNotifications, 'notificationId', notificationIds),
    loanBorrowers: countOrphans(details.loans, 'borrowerId', contactIds),
    borrowingLenders: countOrphans(details.borrowings, 'lenderId', contactIds),
    collectionBorrowers: countOrphans(details.collections, 'borrowerId', contactIds),
    repaymentLenders: countOrphans(details.repayments, 'lenderId', contactIds)
  }

  const output = {
    profileVersion: 2,
    executedAtUtc: new Date().toISOString(),
    environmentMode: mode,
    readOnlyControls: {
      readPreference: 'secondaryPreferred',
      retryWrites: false,
      commands: ['listCollections', 'countDocuments', 'find', 'listIndexes']
    },
    collections: {
      total: collectionNames.length,
      sourceDeclared: sourceCollections.length,
      presentSourceCollections: sourceCollections.filter(name => collectionNames.includes(name)).length,
      absentSourceCollections: sourceCollections.filter(name => !collectionNames.includes(name)),
      counts: Object.fromEntries(sourceCollections.map(name => [name, counts[name] ?? 0])),
      indexes
    },
    transactionHeaders: {
      total: transactions.length,
      active: transactions.filter(isActive).length,
      byType: Object.fromEntries(Object.entries(
        transactions.filter(isActive).reduce((result, transaction) => {
          result[transaction.type ?? '<missing>'] = (result[transaction.type ?? '<missing>'] ?? 0) + 1
          return result
        }, {})
      ).sort(([left], [right]) => left.localeCompare(right)))
    },
    detailStats,
    dataQuality: {
      requiredFields: summarizeRequiredFields(documentsByCollection),
      monetaryValues: summarizeMoney(documentsByCollection),
      timestamps: summarizeTimestamps(documentsByCollection),
      enums: summarizeEnums(documentsByCollection),
      arrays: summarizeArrays(documentsByCollection),
      assets: summarizeAssets(documentsByCollection),
      agenda: summarizeAgenda(documentsByCollection.system_tasks),
      softDeleteCounts: {
        total: sourceCollections.reduce((sum, name) => sum + documentsByCollection[name].filter(document => document._destroy === true).length, 0),
        byCollection: Object.fromEntries(sourceCollections.map(name => [name, documentsByCollection[name].filter(document => document._destroy === true).length]))
      },
      categoryGraph: summarizeCategoryGraph(categories, categoryIds),
      budgetEmbeddedRelations: summarizeBudgetEmbeddedRelations(documentsByCollection.budgets, categoryIds, transactionIds),
      moneySourceReverseLinks: summarizeReverseLinks(moneySources, accounts, accumulations, savings),
      moneyReferenceOrphans: summarizeMoneyReferenceOrphans(details, accounts, accumulations, savings),
      headerDetailIntegrity: summarizeHeaderDetailIntegrity(transactions, details),
      duplicateBusinessKeys: {
        userEmail: duplicateSummary(users, document => document.email?.trim?.().toLowerCase?.() ?? '<missing>'),
        bankCode: duplicateSummary(banks, document => document.code?.trim?.().toLowerCase?.() ?? '<missing>'),
        bankName: duplicateSummary(banks, document => document.name?.trim?.().toLowerCase?.() ?? '<missing>'),
        moneySourceOwner: duplicateSummary(moneySources, document => `${document.ownerType ?? '<missing>'}:${id(document.ownerId) ?? '<missing>'}`),
        contactOwnerName: duplicateSummary(contacts, document => `${document.ownerType ?? '<missing>'}:${id(document.ownerId) ?? '<missing>'}:${document.name?.trim?.().toLowerCase?.() ?? '<missing>'}`),
        categoryOwnerTypeName: duplicateSummary(categories, document => `${document.ownerType ?? '<missing>'}:${id(document.ownerId) ?? '<missing>'}:${document.type ?? '<missing>'}:${document.name?.trim?.().toLowerCase?.() ?? '<missing>'}`),
        detailTransactionId: detailTransactionDuplicates,
        crossSubtypeDetailTransactionId: duplicateSummary(detailCollections.flatMap(name => details[name]), document => id(document.transactionId) ?? '<missing>')
      },
      relationChecks,
      selectedBsonTypes: {
        collectionBorrowerId: Object.fromEntries(Object.entries(details.collections.reduce((result, document) => {
          const type = bsonType(document.borrowerId); result[type] = (result[type] ?? 0) + 1; return result
        }, {})).sort()),
        repaymentLenderId: Object.fromEntries(Object.entries(details.repayments.reduce((result, document) => {
          const type = bsonType(document.lenderId); result[type] = (result[type] ?? 0) + 1; return result
        }, {})).sort())
      }
    },
    reconstructionPolicy: {
      account: 'initBalance + signed active transaction-detail deltas',
      accumulation: '0 + signed active transaction-detail deltas',
      savings_account: '0 + signed active transaction-detail deltas; direct interest credits intentionally not inferred'
    },
    balances: {
      accounts: summarizeBalances(accounts, 'account', document => integer(document.initBalance), deltas),
      accumulations: summarizeBalances(accumulations, 'accumulation', () => 0n, deltas),
      savingsAccounts: summarizeBalances(savings, 'savings_account', () => 0n, deltas)
    }
  }

  console.log(JSON.stringify(output, null, 2))
} finally {
  await client.close()
}
