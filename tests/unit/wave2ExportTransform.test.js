import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { Binary, BSON, Decimal128, Double, Int32, ObjectId } from 'mongodb'
const require = createRequire(import.meta.url)
const reader = require('../../scripts/lib/wave2-export-reader.cjs')
const sanitizer = require('../../scripts/lib/wave2-export-sanitizer.cjs')
const transform = require('../../scripts/lib/wave2-export-transform.cjs')
const { sha256 } = require('../../scripts/lib/wave2-export-manifest.cjs')

const { DECLARED_COLLECTIONS, inspectExportDirectory } = reader
const { computeEvidenceFingerprint, sanitizeExportSnapshot } = sanitizer
const { SYSTEM_ACCOUNT_REGISTRY, TEMPLATE_REGISTRY, buildWave2TransformPlan } = transform
const tempDirectories = []
const oid = (number) => new ObjectId(number.toString(16).padStart(24, '0'))
const at = (day) => new Date(`2026-01-${String(day).padStart(2, '0')}T00:00:00.000Z`)

const createDocuments = ({ includeTransfer = false, includeSaving = false } = {}) => {
  const documents = Object.fromEntries(DECLARED_COLLECTIONS.map((collection) => [collection, []]))
  const accountBalance = includeTransfer ? 95 : 105
  const accumulationBalance = includeTransfer ? 10 : 0
  Object.assign(documents, {
    users: [{
      _id: oid(1), email: 'fixture@example.invalid', password: '$2b$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      username: 'fixture-user', displayName: 'Fixture User', avatar: null, isActive: true,
      currency: 'VND', language: 'fixture', createdAt: at(1), updatedAt: null, _destroy: false
    }],
    banks: [{ _id: oid(2), code: 'FIXTURE', name: 'Fixture Bank', logo: null, createdAt: at(1), updatedAt: null, _destroy: false }],
    categories: [
      { _id: oid(3), ownerType: 'individual', ownerId: oid(1), name: 'Income', type: 'income', childrenIds: [], parentIds: [], createdAt: at(1), updatedAt: null, _destroy: false },
      { _id: oid(4), ownerType: 'individual', ownerId: oid(1), name: 'Expense', type: 'expense', childrenIds: [], parentIds: [], createdAt: at(1), updatedAt: null, _destroy: false },
      { _id: oid(5), ownerType: 'individual', ownerId: oid(1), name: 'Loan', type: 'loan', childrenIds: [], parentIds: [], createdAt: at(1), updatedAt: null, _destroy: false }
    ],
    money_sources: [{
      _id: oid(6), ownerType: 'individual', ownerId: oid(1), accountIds: [oid(7)],
      accumulationIds: [oid(8)], savings_accountIds: includeSaving ? [oid(25)] : [],
      createdAt: at(1), updatedAt: null, _destroy: false
    }],
    accounts: [{
      _id: oid(7), ownerType: 'individual', ownerId: oid(1), moneySourceId: oid(6), type: 'bank',
      accountName: 'Fixture Account', initBalance: new Int32(100), balance: new Int32(accountBalance),
      bankId: oid(2), description: null, icon: null, isBlock: false, transactionIds: [],
      createdAt: at(1), updatedAt: null, _destroy: false
    }],
    accumulations: [{
      _id: oid(8), ownerType: 'individual', ownerId: oid(1), moneySourceId: oid(6),
      accumulationName: 'Fixture Goal', balance: new Int32(accumulationBalance), targetBalance: new Int32(1000),
      startDate: at(1), endDate: at(30), isFinish: false, transactionIds: [], description: null,
      createdAt: at(1), updatedAt: null, _destroy: false
    }],
    contacts: [{ _id: oid(9), ownerType: 'individual', ownerId: oid(1), name: 'Fixture Contact', trustLevel: 'normal', createdAt: at(1), updatedAt: null, _destroy: false }],
    transactions: [
      { _id: oid(10), ownerType: 'individual', ownerId: oid(1), responsiblePersonId: oid(1), proposalId: null, type: 'income', categoryId: oid(3), name: 'Income', amount: new Int32(20), transactionTime: at(2), createdAt: at(2), updatedAt: null, _destroy: false },
      { _id: oid(11), ownerType: 'individual', ownerId: oid(1), responsiblePersonId: oid(1), proposalId: null, type: 'expense', categoryId: oid(4), name: 'Expense', amount: new Int32(10), transactionTime: at(3), createdAt: at(3), updatedAt: null, _destroy: false },
      { _id: oid(12), ownerType: 'individual', ownerId: oid(1), responsiblePersonId: oid(1), proposalId: null, type: 'loan', categoryId: oid(5), name: 'Loan', amount: new Int32(5), transactionTime: at(4), createdAt: at(4), updatedAt: null, _destroy: false }
    ],
    incomes: [{ _id: oid(13), transactionId: oid(10), moneyTargetType: 'account', moneyTargetId: oid(7), images: [], createdAt: at(2), updatedAt: null, _destroy: false }],
    expenses: [{ _id: oid(14), transactionId: oid(11), moneyFromType: 'account', moneyFromId: oid(7), images: [], createdAt: at(3), updatedAt: null, _destroy: false }],
    loans: [{ _id: oid(15), transactionId: oid(12), moneyFromType: 'account', moneyFromId: oid(7), borrowerId: oid(9), rate: new Double(0), collectTime: null, trustLevel: 'normal', images: [], createdAt: at(4), updatedAt: null, _destroy: false }],
    budgets: [{
      _id: oid(16), ownerType: 'individual', ownerId: oid(1), startTime: at(1), endTime: at(30),
      categories: [{ categoryId: oid(4), categoryName: 'Expense', icon: null, childrenIds: [], parentIds: [], amount: new Int32(50), repeat: false, transactionIds: [oid(11)] }],
      createdAt: at(1), updatedAt: null, _destroy: false
    }],
    notifications: [{ _id: oid(17), title: 'Fixture', message: 'Fixture message', type: 'text', link: null, createdAt: at(1), updatedAt: null, _destroy: false }],
    user_notifications: [{ _id: oid(18), userId: oid(1), notificationId: oid(17), isRead: false, readAt: null, receiveAt: at(1) }],
    system_tasks: [{ _id: oid(19), name: 'fixture_job', data: { userId: oid(1) }, type: 'normal', nextRunAt: at(5), priority: new Int32(0) }]
  })
  if (includeTransfer) {
    documents.categories.push({ _id: oid(20), ownerType: 'individual', ownerId: oid(1), name: 'Transfer', type: 'transfer', childrenIds: [], parentIds: [], createdAt: at(1), updatedAt: null, _destroy: false })
    documents.transactions.push({ _id: oid(21), ownerType: 'individual', ownerId: oid(1), responsiblePersonId: oid(1), proposalId: null, type: 'transfer', categoryId: oid(20), name: 'Transfer', amount: new Int32(10), transactionTime: at(5), createdAt: at(5), updatedAt: null, _destroy: false })
    documents.transfers.push({ _id: oid(22), transactionId: oid(21), moneyFromType: 'account', moneyFromId: oid(7), moneyTargetType: 'accumulation', moneyTargetId: oid(8), fee: new Int32(3), images: [], createdAt: at(5), updatedAt: null, _destroy: false })
  }
  if (includeSaving) {
    documents.savings_accounts.push({
      _id: oid(25), ownerType: 'individual', ownerId: oid(1), moneySourceId: oid(6),
      savingsAccountName: 'Fixture Saving', bankId: oid(2), initBalance: new Int32(0), balance: new Int32(0),
      rate: new Double(1), nonTermRate: new Double(0.1), startDate: at(1), term: new Int32(1),
      interestPaid: 'maturity', termEnded: 'close_account', interestPaidTargetId: null,
      interestPaidTargetType: null, description: null, isClosed: false, isRolledOver: false,
      parentSavingId: null, transactionIds: [], moneyFromType: 'account', moneyFromId: oid(7),
      createdAt: at(1), updatedAt: null, _destroy: false
    })
  }
  return documents
}

const createSnapshot = ({ mutate, includeTransfer = false, includeSaving = false } = {}) => {
  const documents = createDocuments({ includeTransfer, includeSaving })
  mutate?.(documents)
  const directory = mkdtempSync(join(tmpdir(), 'wave2-transform-test-'))
  tempDirectories.push(directory)
  const absentCollections = DECLARED_COLLECTIONS.filter((collection) => documents[collection].length === 0)
  DECLARED_COLLECTIONS.filter((collection) => !absentCollections.includes(collection)).forEach((collection, index) => {
    const bson = Buffer.concat(documents[collection].map((document) => BSON.serialize(document)))
    writeFileSync(join(directory, `${collection}.bson`), bson)
    writeFileSync(join(directory, `${collection}.metadata.json`), JSON.stringify({
      indexes: [{ v: { $numberInt: '2' }, key: { _id: { $numberInt: '1' } }, name: '_id_' }],
      uuid: (index + 1).toString(16).padStart(32, '0'), collectionName: collection, type: 'collection'
    }))
  })
  return sanitizeExportSnapshot(inspectExportDirectory({ directory, absentCollections }))
}

afterEach(() => {
  while (tempDirectories.length) {
    const directory = tempDirectories.pop()
    if (directory.startsWith(tmpdir())) rmSync(directory, { recursive: true, force: true })
  }
})

describe('Wave 2 pure export transform plan', () => {
  it('classifies every record once and creates a deterministic PII-safe balanced plan', () => {
    const first = buildWave2TransformPlan(createSnapshot())
    const second = buildWave2TransformPlan(createSnapshot())
    const serialized = JSON.stringify(first)

    expect(first.summary.routeCount).toBe(26)
    expect(first.canonicalPlan.routes.filter((route) => route.sourceState === 'PRESENT')).toHaveLength(15)
    expect(first.canonicalPlan.routes.filter((route) => route.sourceState === 'ABSENT')).toHaveLength(11)
    expect(first.summary.sourceCount).toBe(
      first.summary.loadedCount + first.summary.archivedCount + first.summary.rejectedCount
    )
    expect(first.summary.archivedCount).toBe(2)
    expect(first.summary.rejectedCount).toBe(0)
    expect(first.summary.blockingCount).toBe(0)
    expect(first.summary.balanceHolderCount).toBe(2)
    expect(first.summary.balanceMismatchCount).toBe(0)
    expect(first.summary.detailDistribution).toMatchObject({ expenses: 1, incomes: 1, loans: 1 })
    expect(first.canonicalPlan.notificationTargets).toEqual([{
      legacyId: oid(17).toHexString(), notificationType: 'TEXT', hasLink: false
    }])
    expect(first.canonicalPlan.notificationRecipientTargets[0]).toMatchObject({
      legacyId: oid(18).toHexString(), userLegacyId: oid(1).toHexString(),
      notificationLegacyId: oid(17).toHexString(), isRead: false,
      receivedAt: at(1).toISOString(), readAt: null
    })
    expect(first.summary.planHash).toBe(second.summary.planHash)
    expect(new Set(first.canonicalPlan.dispositions.map((item) => `${item.collection}:${item.legacyId}`)).size)
      .toBe(first.summary.sourceCount)
    expect(first.canonicalPlan.postings.every((posting) =>
      posting.entries.reduce((sum, entry) => sum + entry.amount, 0) === 0)).toBe(true)
    const dispositions = new Map(first.canonicalPlan.dispositions.map((item) => [`${item.collection}:${item.legacyId}`, item.disposition]))
    expect(first.canonicalPlan.postings.every((posting) =>
      posting.sourceRefs.every((identity) => dispositions.get(identity) === 'LOADED'))).toBe(true)
    const ledgerEntries = first.canonicalPlan.postings.flatMap((posting) => posting.entries)
    for (const ledgerRef of new Set(ledgerEntries.map((entry) => entry.ledgerRef))) {
      const chain = ledgerEntries.filter((entry) => entry.ledgerRef === ledgerRef)
      expect(chain.map((entry) => entry.sequence)).toEqual(chain.map((_entry, index) => index + 1))
      expect(chain[0].balanceBefore).toBe(0)
      for (let index = 1; index < chain.length; index += 1) {
        expect(chain[index].balanceBefore).toBe(chain[index - 1].balanceAfter)
      }
    }
    expect(Object.keys(SYSTEM_ACCOUNT_REGISTRY).sort()).toEqual([
      'BORROWING_LIABILITY', 'EXPENSE_CLEARING', 'INCOME_CLEARING', 'INTEREST_EXPENSE',
      'INTERSPACE_CLEARING', 'LOAN_RECEIVABLE', 'MIGRATION_EQUITY', 'OPENING_EQUITY'
    ])
    expect(Object.keys(TEMPLATE_REGISTRY)).toHaveLength(18)
    expect(first.canonicalPlan.postings.every((posting) => posting.entries.every((entry) =>
      entry.accountKind !== 'SYSTEM' || entry.ledgerRef === `${entry.space}|system:${entry.systemRole}`))).toBe(true)
    expect(serialized).not.toMatch(/fixture@example|fixture-user|Fixture User|\$2b\$|public_id|publicId/i)
    expect(() => { first.canonicalPlan.routes[0].sourceCount = 999 }).toThrow()
    const operational = first.getOperationalTargetPlan()
    expect(operational.getLoadedDocuments('accounts')).toHaveLength(1)
    expect(() => { operational.postingPlan[0].amount = 999 }).toThrow()
    expect(() => operational.getLoadedDocuments('unknown')).toThrow(/unknown declared collection/i)
  })

  it.each([
    ['orphan relation', (docs) => { docs.expenses[0].moneyFromId = oid(99) }, 'UNRESOLVED_MONEY_REFERENCE'],
    ['unsafe money', (docs) => { docs.transactions[0].amount = new Double(Number.MAX_SAFE_INTEGER + 2) }, 'INVALID_BSON_TYPE'],
    ['duplicate identity', (docs) => { docs.users.push({ ...docs.users[0], _id: oid(30), username: 'other-user' }) }, 'IDENTITY_BUSINESS_KEY_DUPLICATE'],
    ['wrong detail', (docs) => { docs.transactions[0].type = 'expense' }, 'MISSING_DUPLICATE_OR_WRONG_DETAIL'],
    ['balance mismatch', (docs) => { docs.accounts[0].balance = new Int32(999) }, 'BALANCE_MISMATCH'],
    ['BSON type mismatch', (docs) => { docs.accounts[0].ownerType = new Int32(1) }, 'INVALID_BSON_TYPE']
  ])('classifies %s instead of silently skipping it', (_name, mutate, code) => {
    const plan = buildWave2TransformPlan(createSnapshot({ mutate }))
    expect(plan.summary.blockingCount).toBeGreaterThan(0)
    expect(plan.summary.rejectedCount).toBeGreaterThan(0)
    expect(plan.canonicalPlan.discrepancies.some((item) => item.code === code)).toBe(true)
    expect(plan.summary.unclassifiedCount).toBe(0)
  })

  it('preserves a future transfer fee as metadata with zero inferred ledger effect', () => {
    const plan = buildWave2TransformPlan(createSnapshot({ includeTransfer: true }))
    const transfer = plan.canonicalPlan.postings.find((posting) => posting.templateCode === 'TRANSFER')

    expect(plan.summary.blockingCount).toBe(0)
    expect(plan.summary.balanceMismatchCount).toBe(0)
    expect(transfer.amount).toBe(10)
    expect(transfer.entries.map((entry) => entry.amount).sort((a, b) => a - b)).toEqual([-10, 10])
    expect(transfer.metadata).toEqual({ legacyFee: 3, feeLedgerEffect: 0 })
    expect(JSON.stringify(transfer)).not.toContain('"amount":3')
  })

  it.each([
    ['negative fee', (docs) => { docs.transfers[0].fee = new Int32(-1) }, 'INVALID_TRANSFER_FEE'],
    ['same source and target', (docs) => {
      docs.transfers[0].moneyTargetType = 'account'
      docs.transfers[0].moneyTargetId = oid(7)
    }, 'TRANSFER_SOURCE_EQUALS_TARGET'],
    ['blocked source', (docs) => { docs.accounts[0].isBlock = true }, 'TRANSFER_SOURCE_INACTIVE_OR_BLOCKED'],
    ['cross-space target', (docs) => {
      docs.users.push({ ...docs.users[0], _id: oid(46), email: 'other@example.invalid', username: 'other' })
      docs.money_sources.push({
        _id: oid(47), ownerType: 'individual', ownerId: oid(46), accountIds: [oid(48)], accumulationIds: [], savings_accountIds: [],
        createdAt: at(1), updatedAt: null, _destroy: false
      })
      docs.accounts.push({
        ...docs.accounts[0], _id: oid(48), ownerId: oid(46), moneySourceId: oid(47), type: 'cash', bankId: null,
        accountName: 'Other Cash', initBalance: new Int32(0), balance: new Int32(0), isBlock: false
      })
      docs.transfers[0].moneyTargetType = 'account'
      docs.transfers[0].moneyTargetId = oid(48)
    }, 'CROSS_SPACE_TRANSFER']
  ])('rejects transfer with %s', (_name, mutate, code) => {
    const plan = buildWave2TransformPlan(createSnapshot({ includeTransfer: true, mutate: (docs) => {
      docs.accounts[0].balance = new Int32(105)
      docs.accumulations[0].balance = new Int32(0)
      mutate(docs)
    } }))
    expect(plan.canonicalPlan.discrepancies.some((item) => item.code === code)).toBe(true)
    expect(plan.canonicalPlan.postings.some((posting) => posting.templateCode === 'TRANSFER')).toBe(false)
  })

  it('emits canonical budget allocations and exposes normalized rows to the loader boundary', () => {
    const plan = buildWave2TransformPlan(createSnapshot({ mutate: (docs) => { docs.budgets[0].categories[0].amount = '50' } }))
    expect(plan.summary.blockingCount).toBe(0)
    expect(plan.canonicalPlan.budgetTargets[0].allocations[0]).toMatchObject({
      categoryLegacyId: oid(4).toHexString(), amount: 50, repeat: false,
      transactionLegacyIds: [oid(11).toHexString()]
    })
    const loaderBudget = plan.getOperationalTargetPlan().getLoadedDocuments('budgets')[0]
    expect(loaderBudget.allocations[0].amount).toBe(50)
    expect(loaderBudget).not.toHaveProperty('categories')
  })

  it('returns fresh authentic BSON leaves from the loader accessor after caller mutation', () => {
    const plan = buildWave2TransformPlan(createSnapshot({ mutate: (docs) => {
      docs.users[0].avatar = new Binary(Buffer.from([1, 2, 3]), 0)
    } }))
    const loader = plan.getOperationalTargetPlan()
    const firstUser = loader.getLoadedDocuments('users')[0]
    const firstAccount = loader.getLoadedDocuments('accounts')[0]
    firstUser._id.id[0] = 255
    firstUser.createdAt.setUTCFullYear(2000)
    firstUser.avatar.buffer[0] = 255
    firstAccount.initBalance.value = 999

    const secondUser = loader.getLoadedDocuments('users')[0]
    const secondAccount = loader.getLoadedDocuments('accounts')[0]
    expect(secondUser._id.toHexString()).toBe(oid(1).toHexString())
    expect(secondUser.createdAt.toISOString()).toBe(at(1).toISOString())
    expect([...secondUser.avatar.buffer]).toEqual([1, 2, 3])
    expect(secondAccount.initBalance.value).toBe(100)
  })

  it('does not invent an opening posting for a zero initialized account', () => {
    const plan = buildWave2TransformPlan(createSnapshot({ mutate: (docs) => {
      docs.accounts.push({
        ...docs.accounts[0], _id: oid(23), accountName: 'Zero Account', type: 'cash', bankId: null,
        initBalance: new Int32(0), balance: new Int32(0)
      })
      docs.money_sources[0].accountIds.push(oid(23))
    } }))
    expect(plan.summary.blockingCount).toBe(0)
    expect(plan.canonicalPlan.postings.some((posting) =>
      posting.templateCode === 'OPENING_BALANCE' && posting.legacyId === oid(23).toHexString())).toBe(false)
    expect(plan.canonicalPlan.postings.some((posting) => posting.entries.some((entry) =>
      entry.systemRole === 'MIGRATION_EQUITY'))).toBe(false)
  })

  it('builds an atomic, locally balanced personal-to-family contribution pair', () => {
    const plan = buildWave2TransformPlan(createSnapshot({ mutate: (docs) => {
      docs.users.push({ ...docs.users[0], _id: oid(31), email: 'member@example.invalid', username: 'member' })
      docs.families.push({
        _id: oid(34), familyName: 'Fixture Family', ownerId: oid(1), managerIds: [], memberIds: [oid(31)],
        createdAt: at(1), updatedAt: null, _destroy: false
      })
      docs.categories.push({
        _id: oid(33), ownerType: 'individual', ownerId: oid(31), name: 'Contribution', type: 'contribution',
        childrenIds: [], parentIds: [], createdAt: at(1), updatedAt: null, _destroy: false
      })
      docs.money_sources.push(
        { _id: oid(35), ownerType: 'individual', ownerId: oid(31), accountIds: [oid(36)], accumulationIds: [], savings_accountIds: [], createdAt: at(1), updatedAt: null, _destroy: false },
        { _id: oid(37), ownerType: 'family', ownerId: oid(34), accountIds: [oid(38)], accumulationIds: [], savings_accountIds: [], createdAt: at(1), updatedAt: null, _destroy: false }
      )
      docs.accounts.push(
        { ...docs.accounts[0], _id: oid(36), ownerId: oid(31), moneySourceId: oid(35), type: 'cash', bankId: null, accountName: 'Member Cash', initBalance: new Int32(100), balance: new Int32(90) },
        { ...docs.accounts[0], _id: oid(38), ownerType: 'family', ownerId: oid(34), moneySourceId: oid(37), type: 'cash', bankId: null, accountName: 'Family Cash', initBalance: new Int32(0), balance: new Int32(10) }
      )
      docs.transactions.push({
        _id: oid(39), ownerType: 'individual', ownerId: oid(31), responsiblePersonId: oid(31), proposalId: null,
        type: 'contribution', categoryId: oid(33), name: 'Contribution', amount: new Int32(10),
        transactionTime: at(5), createdAt: at(5), updatedAt: null, _destroy: false
      })
      docs.contributions.push({
        _id: oid(40), transactionId: oid(39), recipientId: oid(34), moneyFromType: 'account', moneyFromId: oid(36),
        moneyTargetType: 'account', moneyTargetId: oid(38), contributionRequestId: null, images: [],
        createdAt: at(5), updatedAt: null, _destroy: false
      })
    } }))
    const pair = plan.canonicalPlan.postings.filter((posting) => posting.atomicGroup === `contribution:${oid(39).toHexString()}`)
    expect(plan.summary.blockingCount).toBe(0)
    expect(pair.map((posting) => posting.templateCode).sort()).toEqual(['CONTRIBUTION_IN', 'CONTRIBUTION_OUT'])
    expect(new Set(pair.map((posting) => posting.entries[0].space))).toHaveLength(2)
    expect(pair.every((posting) => posting.entries.reduce((sum, entry) => sum + entry.amount, 0) === 0)).toBe(true)
  })

  it('retains original debt agreement evidence and rejects duplicate full settlements', () => {
    const addCollection = (docs, transactionId, detailId, day) => {
      docs.transactions.push({
        _id: oid(transactionId), ownerType: 'individual', ownerId: oid(1), responsiblePersonId: oid(1), proposalId: null,
        type: 'collect', categoryId: oid(5), name: 'Collect', amount: new Int32(5), transactionTime: at(day),
        createdAt: at(day), updatedAt: null, _destroy: false
      })
      docs.collections.push({
        _id: oid(detailId), transactionId: oid(transactionId), loanTransactionId: oid(12), borrowerId: oid(9),
        moneyTargetType: 'account', moneyTargetId: oid(7), realCollectTime: at(day), images: [],
        createdAt: at(day), updatedAt: null, _destroy: false
      })
    }
    const valid = buildWave2TransformPlan(createSnapshot({ mutate: (docs) => {
      addCollection(docs, 26, 27, 5)
      docs.accounts[0].balance = new Int32(110)
    } }))
    const collection = valid.canonicalPlan.postings.find((posting) => posting.templateCode === 'COLLECTION')
    expect(valid.summary.blockingCount).toBe(0)
    expect(collection.metadata).toMatchObject({
      originAgreementTransactionLegacyId: oid(12).toHexString(),
      originAgreementDetailLegacyId: oid(15).toHexString(),
      contactLegacyId: oid(9).toHexString(),
      fullPrincipalAmount: 5,
      rateBasis: 'UNSPECIFIED',
      headerOccurredAt: at(5).toISOString(),
      detailOccurredAt: at(5).toISOString()
    })
    expect(collection.occurredAt).toBe(at(5).toISOString())

    const duplicate = buildWave2TransformPlan(createSnapshot({ mutate: (docs) => {
      addCollection(docs, 26, 27, 5)
      addCollection(docs, 28, 29, 6)
    } }))
    expect(duplicate.canonicalPlan.discrepancies.filter((item) => item.code === 'DUPLICATE_DEBT_SETTLEMENT')).toHaveLength(2)
    expect(duplicate.canonicalPlan.postings.some((posting) => posting.templateCode === 'COLLECTION')).toBe(false)

    const mismatched = buildWave2TransformPlan(createSnapshot({ mutate: (docs) => {
      addCollection(docs, 26, 27, 5)
      docs.collections[0].realCollectTime = at(6)
    } }))
    expect(mismatched.canonicalPlan.discrepancies.some((item) => item.code === 'SETTLEMENT_TIME_MISMATCH')).toBe(true)
    expect(mismatched.canonicalPlan.postings.some((posting) => posting.templateCode === 'COLLECTION')).toBe(false)
  })

  it('accepts a zero-principal saving term without inventing a posting or interest', () => {
    const plan = buildWave2TransformPlan(createSnapshot({ includeSaving: true }))
    expect(plan.summary.blockingCount).toBe(0)
    expect(plan.canonicalPlan.postings.some((item) => item.templateCode.startsWith('SAVING_'))).toBe(false)
    expect(plan.canonicalPlan.savingTerms).toHaveLength(1)
  })

  it('posts only the explicit saving principal and blocks an unexplained stored interest delta', () => {
    const valid = buildWave2TransformPlan(createSnapshot({
      includeSaving: true,
      mutate: (docs) => {
        docs.accounts[0].balance = new Int32(95)
        docs.savings_accounts[0].initBalance = new Int32(10)
        docs.savings_accounts[0].balance = new Int32(10)
      }
    }))
    const deposit = valid.canonicalPlan.postings.find((posting) => posting.templateCode === 'SAVING_DEPOSIT')
    expect(valid.summary.blockingCount).toBe(0)
    expect(deposit.entries.map((entry) => entry.amount)).toEqual([-10, 10])
    expect(valid.canonicalPlan.postings.some((posting) => posting.templateCode.includes('INTEREST'))).toBe(false)

    const ambiguous = buildWave2TransformPlan(createSnapshot({
      includeSaving: true,
      mutate: (docs) => {
        docs.accounts[0].balance = new Int32(95)
        docs.savings_accounts[0].initBalance = new Int32(10)
        docs.savings_accounts[0].balance = new Int32(11)
      }
    }))
    expect(ambiguous.canonicalPlan.discrepancies.some((item) => item.code === 'AMBIGUOUS_SAVING_INTEREST')).toBe(true)
    expect(ambiguous.canonicalPlan.postings.some((posting) => posting.templateCode.startsWith('SAVING_'))).toBe(false)
  })

  it.each([
    ['missing bank', (docs) => { docs.savings_accounts[0].bankId = oid(99) }, 'UNRESOLVED_BANK_REFERENCE'],
    ['invalid schedule enum', (docs) => { docs.savings_accounts[0].interestPaid = 'weekly' }, 'INVALID_SAVING_ENUM'],
    ['missing monthly interest target', (docs) => { docs.savings_accounts[0].interestPaid = 'monthly' }, 'INVALID_SAVING_INTEREST_TARGET']
  ])('rejects saving with %s', (_name, mutate, code) => {
    const plan = buildWave2TransformPlan(createSnapshot({ includeSaving: true, mutate }))
    expect(plan.canonicalPlan.discrepancies.some((item) => item.code === code)).toBe(true)
    expect(plan.canonicalPlan.postings.some((posting) => posting.templateCode.startsWith('SAVING_'))).toBe(false)
  })

  it('emits a deterministic principal-only saving rollover without inferred interest', () => {
    const plan = buildWave2TransformPlan(createSnapshot({ includeSaving: true, mutate: (docs) => {
      const parent = docs.savings_accounts[0]
      docs.accounts[0].balance = new Int32(95)
      Object.assign(parent, {
        initBalance: new Int32(10), balance: new Int32(0), termEnded: 'roll_over_principal',
        interestPaidTargetType: 'account', interestPaidTargetId: oid(7), isClosed: true
      })
      docs.savings_accounts.push({
        ...parent, _id: oid(41), savingsAccountName: 'Rolled Saving', balance: new Int32(10),
        startDate: new Date('2026-02-01T00:00:00.000Z'), isClosed: false, isRolledOver: true,
        parentSavingId: oid(25), moneyFromType: 'savings_account', moneyFromId: oid(25),
        createdAt: new Date('2026-02-01T00:00:00.000Z')
      })
      docs.money_sources[0].savings_accountIds.push(oid(41))
    } }))
    const rollover = plan.canonicalPlan.postings.find((posting) => posting.templateCode === 'SAVING_ROLLOVER_PRINCIPAL')
    expect(plan.summary.blockingCount).toBe(0)
    expect(rollover.entries.map((entry) => entry.amount)).toEqual([-10, 10])
    expect(rollover.metadata).toEqual({ parentSavingLegacyId: oid(25).toHexString(), interestLedgerEffect: 0 })
    expect(plan.canonicalPlan.postings.some((posting) => posting.templateCode.includes('INTEREST'))).toBe(false)
  })

  it('rejects a forged operational accessor even when the evidence wrapper is reused', () => {
    const snapshot = createSnapshot()
    const forged = {
      evidenceManifest: snapshot.evidenceManifest,
      getEvidenceRecords: snapshot.getEvidenceRecords,
      getOperationalRecords(collection) {
        const documents = snapshot.getOperationalRecords(collection)
        if (collection !== 'accounts') return documents
        const account = BSON.deserialize(BSON.serialize(documents[0]))
        account.balance = new Int32(999)
        return Object.freeze([Object.freeze(account)])
      }
    }
    expect(() => buildWave2TransformPlan(forged)).toThrow(/sanitizer-issued operational snapshot/i)
  })

  it('rejects a recomputed wrapper that changes bcrypt plus tuple and fingerprint over the same raw source', () => {
    const snapshot = createSnapshot()
    const changedPassword = '$2b$12$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    const user = BSON.deserialize(BSON.serialize(snapshot.getOperationalRecords('users')[0]))
    user.password = changedPassword
    const changedOperationalHash = sha256(BSON.serialize(user))
    const manifest = JSON.parse(JSON.stringify(snapshot.evidenceManifest))
    manifest.recordTuples.find((tuple) => tuple.collection === 'users').operationalDocumentHash = changedOperationalHash
    manifest.evidenceFingerprint = computeEvidenceFingerprint(manifest)
    const wrapper = {
      evidenceManifest: manifest,
      getEvidenceRecords(collection) {
        const records = snapshot.getEvidenceRecords(collection)
        if (collection !== 'users') return records
        const evidence = JSON.parse(JSON.stringify(records[0]))
        evidence.operationalDocumentHash = changedOperationalHash
        return [evidence]
      },
      getOperationalRecords(collection) {
        return collection === 'users' ? [user] : snapshot.getOperationalRecords(collection)
      }
    }
    expect(() => buildWave2TransformPlan(wrapper)).toThrow(/sanitizer-issued operational snapshot/i)
  })

  it.each([
    ['rejected owner', (docs) => { docs.users[0].email = null }, 'REJECTED_DEPENDENCY'],
    ['rejected category', (docs) => { docs.categories[0].ownerType = new Int32(1) }, 'REJECTED_DEPENDENCY'],
    ['personal actor differs from owner', (docs) => {
      docs.users.push({ ...docs.users[0], _id: oid(42), email: 'actor@example.invalid', username: 'actor' })
      docs.transactions[0].responsiblePersonId = oid(42)
    }, 'RESPONSIBLE_USER_NOT_PERSONAL_OWNER']
  ])('propagates %s and emits no posting from the rejected graph', (_name, mutate, code) => {
    const plan = buildWave2TransformPlan(createSnapshot({ mutate }))
    const rejected = new Set(plan.canonicalPlan.dispositions
      .filter((item) => item.disposition === 'REJECTED').map((item) => `${item.collection}:${item.legacyId}`))
    expect(plan.canonicalPlan.discrepancies.some((item) => item.code === code)).toBe(true)
    expect(plan.canonicalPlan.postings.every((posting) => posting.sourceRefs.every((identity) => !rejected.has(identity)))).toBe(true)
  })

  it('propagates budget and notification foreign-key rejection into canonical targets', () => {
    const budgetPlan = buildWave2TransformPlan(createSnapshot({ mutate: (docs) => {
      docs.categories[1].ownerType = new Int32(1)
    } }))
    expect(budgetPlan.canonicalPlan.dispositions.find((item) => item.collection === 'budgets').disposition).toBe('REJECTED')
    expect(budgetPlan.canonicalPlan.budgetTargets).toHaveLength(0)

    const notificationPlan = buildWave2TransformPlan(createSnapshot({ mutate: (docs) => {
      docs.user_notifications[0].notificationId = oid(99)
    } }))
    expect(notificationPlan.canonicalPlan.dispositions.find((item) => item.collection === 'user_notifications').disposition)
      .toBe('REJECTED')
    expect(notificationPlan.canonicalPlan.targets.every((target) => target.dependencyRefs.every((reference) =>
      ['LOADED', 'APPROVED_ARCHIVE'].includes(reference.disposition)))).toBe(true)
  })

  it.each([
    ['malformed userId', (docs) => { docs.user_notifications[0].userId = 'not-an-object-id' }, 'userId'],
    ['malformed notificationId', (docs) => { docs.user_notifications[0].notificationId = 'not-an-object-id' }, 'notificationId']
  ])('rejects %s during schema validation and omits its canonical target', (_name, mutate, path) => {
    const plan = buildWave2TransformPlan(createSnapshot({ mutate }))
    const recipientDisposition = plan.canonicalPlan.dispositions.find((item) => item.collection === 'user_notifications')
    expect(plan.canonicalPlan.discrepancies).toContainEqual(expect.objectContaining({
      collection: 'user_notifications', code: 'INVALID_BSON_TYPE', severity: 'BLOCKING', path
    }))
    expect(recipientDisposition.disposition).toBe('REJECTED')
    expect(plan.canonicalPlan.notificationRecipientTargets).toHaveLength(0)
  })

  it('accepts canonical 24-hex FK strings and emits normalized notification loader DTOs', () => {
    const plan = buildWave2TransformPlan(createSnapshot({ mutate: (docs) => {
      docs.user_notifications[0].userId = oid(1).toHexString()
      docs.user_notifications[0].notificationId = oid(17).toHexString()
    } }))
    expect(plan.summary.blockingCount).toBe(0)
    expect(plan.canonicalPlan.notificationRecipientTargets[0]).toMatchObject({
      userLegacyId: oid(1).toHexString(), notificationLegacyId: oid(17).toHexString()
    })
    expect(plan.getOperationalTargetPlan().getLoadedDocuments('notifications')[0]).toMatchObject({
      legacyId: oid(17).toHexString(), notificationType: 'TEXT'
    })
    expect(plan.getOperationalTargetPlan().getLoadedDocuments('user_notifications')[0]).toMatchObject({
      userLegacyId: oid(1).toHexString(), notificationLegacyId: oid(17).toHexString()
    })
  })

  it('rejects missing notification parents and unsupported legacy notification enums', () => {
    const missingParent = buildWave2TransformPlan(createSnapshot({ mutate: (docs) => {
      docs.user_notifications[0].notificationId = oid(99)
    } }))
    expect(missingParent.canonicalPlan.discrepancies).toContainEqual(expect.objectContaining({
      code: 'UNRESOLVED_NOTIFICATION_REFERENCE', severity: 'BLOCKING'
    }))
    expect(missingParent.canonicalPlan.notificationRecipientTargets).toHaveLength(0)

    const invalidEnum = buildWave2TransformPlan(createSnapshot({ mutate: (docs) => {
      docs.notifications[0].type = 'unsupported'
    } }))
    expect(invalidEnum.canonicalPlan.discrepancies).toContainEqual(expect.objectContaining({
      code: 'INVALID_NOTIFICATION_ENUM', severity: 'BLOCKING'
    }))
    expect(invalidEnum.canonicalPlan.dispositions.find((item) => item.collection === 'notifications').disposition).toBe('REJECTED')
    expect(invalidEnum.canonicalPlan.notificationTargets).toHaveLength(0)
    expect(invalidEnum.canonicalPlan.notificationRecipientTargets).toHaveLength(0)
  })

  it.each([
    ['missing receiveAt', (docs) => { delete docs.user_notifications[0].receiveAt }, 'MISSING_REQUIRED_FIELD', 'receiveAt'],
    ['null receiveAt', (docs) => { docs.user_notifications[0].receiveAt = null }, 'MISSING_REQUIRED_FIELD', 'receiveAt'],
    ['invalid receiveAt', (docs) => { docs.user_notifications[0].receiveAt = 'not-a-time' }, 'INVALID_BSON_TYPE', 'receiveAt'],
    ['missing isRead', (docs) => { delete docs.user_notifications[0].isRead }, 'MISSING_REQUIRED_FIELD', 'isRead'],
    ['wrong isRead type', (docs) => { docs.user_notifications[0].isRead = 'false' }, 'INVALID_BSON_TYPE', 'isRead'],
    ['read true without readAt', (docs) => { docs.user_notifications[0].isRead = true }, 'INVALID_NOTIFICATION_READ_STATE', 'readAt'],
    ['read false with readAt', (docs) => { docs.user_notifications[0].readAt = at(2) }, 'INVALID_NOTIFICATION_READ_STATE', 'readAt'],
    ['invalid readAt timestamp', (docs) => {
      docs.user_notifications[0].isRead = true
      docs.user_notifications[0].readAt = 'not-a-time'
    }, 'INVALID_BSON_TYPE', 'readAt']
  ])('rejects notification recipient with %s and omits all load targets', (_name, mutate, code, path) => {
    const plan = buildWave2TransformPlan(createSnapshot({ mutate }))
    expect(plan.canonicalPlan.discrepancies).toContainEqual(expect.objectContaining({
      collection: 'user_notifications', code, severity: 'BLOCKING', path
    }))
    expect(plan.canonicalPlan.dispositions.find((item) => item.collection === 'user_notifications').disposition)
      .toBe('REJECTED')
    expect(plan.canonicalPlan.notificationRecipientTargets).toHaveLength(0)
    expect(plan.getOperationalTargetPlan().getLoadedDocuments('user_notifications')).toHaveLength(0)
  })

  it.each([
    ['unread', false, null],
    ['read', true, at(2)]
  ])('preserves valid %s recipient timestamps in the exact loader contract', (_name, isRead, readAt) => {
    const plan = buildWave2TransformPlan(createSnapshot({ mutate: (docs) => {
      docs.user_notifications[0].isRead = isRead
      docs.user_notifications[0].readAt = readAt
    } }))
    const canonical = plan.canonicalPlan.notificationRecipientTargets[0]
    const loader = plan.getOperationalTargetPlan().getLoadedDocuments('user_notifications')[0]
    expect(plan.summary.blockingCount).toBe(0)
    expect(canonical).toMatchObject({
      isRead, receivedAt: at(1).toISOString(), readAt: readAt?.toISOString() || null
    })
    expect(loader).toEqual(canonical)
    expect(loader).not.toHaveProperty('receiveAt')
  })

  it('allows a signed negative opening plus improving inflow but rejects outgoing while still negative', () => {
    const signed = buildWave2TransformPlan(createSnapshot({ mutate: (docs) => {
      docs.accounts.push({
        ...docs.accounts[0], _id: oid(43), type: 'cash', bankId: null, accountName: 'Signed Opening',
        initBalance: new Int32(-10), balance: new Int32(-5)
      })
      docs.money_sources[0].accountIds.push(oid(43))
      docs.transactions.push({
        ...docs.transactions[0], _id: oid(49), name: 'Partial recovery', amount: new Int32(5), transactionTime: at(5), createdAt: at(5)
      })
      docs.incomes.push({ ...docs.incomes[0], _id: oid(50), transactionId: oid(49), moneyTargetId: oid(43), createdAt: at(5) })
    } }))
    const opening = signed.canonicalPlan.postings.find((posting) => posting.legacyId === oid(43).toHexString())
    expect(signed.summary.blockingCount).toBe(0)
    expect(opening.templateCode).toBe('OPENING_BALANCE')
    expect(opening.entries.map((entry) => entry.amount)).toEqual([-10, 10])

    const outgoing = buildWave2TransformPlan(createSnapshot({ mutate: (docs) => {
      docs.accounts.push({
        ...docs.accounts[0], _id: oid(43), type: 'cash', bankId: null, accountName: 'Signed Opening',
        initBalance: new Int32(-10), balance: new Int32(-10)
      })
      docs.money_sources[0].accountIds.push(oid(43))
      docs.transactions.push({
        ...docs.transactions[1], _id: oid(51), name: 'Invalid outgoing', amount: new Int32(1), transactionTime: at(5), createdAt: at(5)
      })
      docs.expenses.push({ ...docs.expenses[0], _id: oid(52), transactionId: oid(51), moneyFromId: oid(43), createdAt: at(5) })
    } }))
    expect(outgoing.canonicalPlan.discrepancies.some((item) => item.code === 'NEGATIVE_INTERMEDIATE_BALANCE')).toBe(true)
    expect(outgoing.canonicalPlan.postings.some((posting) => posting.legacyId === oid(51).toHexString())).toBe(false)
  })

  it('rejects a backdated debt settlement', () => {

    const backdated = buildWave2TransformPlan(createSnapshot({ mutate: (docs) => {
      docs.transactions.push({ ...docs.transactions[2], _id: oid(44), type: 'collect', name: 'Backdated', transactionTime: at(3), createdAt: at(3) })
      docs.collections.push({
        _id: oid(45), transactionId: oid(44), loanTransactionId: oid(12), borrowerId: oid(9),
        moneyTargetType: 'account', moneyTargetId: oid(7), realCollectTime: at(3), images: [],
        createdAt: at(3), updatedAt: null, _destroy: false
      })
    } }))
    expect(backdated.canonicalPlan.discrepancies.some((item) => item.code === 'INVALID_DEBT_FULL_SETTLEMENT')).toBe(true)
    expect(backdated.canonicalPlan.postings.some((posting) => posting.legacyId === oid(44).toHexString())).toBe(false)
  })

  it('preserves exact valid debt rate text and rejects invalid rate values', () => {
    const exact = buildWave2TransformPlan(createSnapshot({ mutate: (docs) => { docs.loans[0].rate = Decimal128.fromString('1.2300') } }))
    expect(exact.summary.blockingCount).toBe(0)
    expect(exact.canonicalPlan.postings.find((posting) => posting.templateCode === 'LOAN_DISBURSEMENT').metadata)
      .toMatchObject({ rate: '1.2300', rateBasis: 'UNSPECIFIED' })
    const invalid = buildWave2TransformPlan(createSnapshot({ mutate: (docs) => { docs.loans[0].rate = new Double(-1) } }))
    expect(invalid.canonicalPlan.discrepancies.some((item) => item.code === 'INVALID_DEBT_RATE')).toBe(true)
  })
})
