import 'dotenv/config'
import { createHash } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const connectionString = process.env.POSTGRESQL_DATABASE_URL
if (!connectionString) {
  throw new Error('POSTGRESQL_DATABASE_URL is required for the Wave 2 system seed')
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })
const effectiveAt = new Date('2026-08-02T00:00:00.000Z')

const systemAccounts = [
  ['OPENING_EQUITY', 'CREDIT', true, 'Counter-account for explicit signed opening balances.'],
  ['MIGRATION_EQUITY', 'CREDIT', true, 'Audited counter-account for approved migration anchors only.'],
  ['INCOME_CLEARING', 'CREDIT', true, 'Space-local counter-account for externally sourced income.'],
  ['EXPENSE_CLEARING', 'DEBIT', false, 'Space-local counter-account for externally consumed expense.'],
  ['LOAN_RECEIVABLE', 'DEBIT', false, 'Space-local principal receivable for loan disbursement and collection.'],
  ['BORROWING_LIABILITY', 'CREDIT', true, 'Space-local principal liability for borrowing and repayment.'],
  ['INTEREST_EXPENSE', 'DEBIT', true, 'Space-local source for explicitly recognized saving interest.'],
  ['INTERSPACE_CLEARING', 'DEBIT', true, 'Space-local clearing side for an atomic personal-to-family contribution.']
] as const

type AccountKind = 'USER_BALANCE' | 'SYSTEM'
type SignRule = 'POSITIVE' | 'NEGATIVE' | 'VARIABLE'

type EntryRole = {
  entryRole: string
  accountKind: AccountKind
  systemRole?: string
  sign: SignRule
  minimum?: number
  maximum?: number
}

const user = (entryRole: string, sign: SignRule, minimum = 1, maximum = 1): EntryRole => ({
  entryRole,
  accountKind: 'USER_BALANCE',
  sign,
  minimum,
  maximum
})

const system = (
  entryRole: string,
  systemRole: string,
  sign: SignRule,
  minimum = 1,
  maximum = 1
): EntryRole => ({ entryRole, accountKind: 'SYSTEM', systemRole, sign, minimum, maximum })

const templates: Array<{ code: string; roles: EntryRole[] }> = [
  {
    code: 'OPENING_BALANCE',
    roles: [
      user('ACCOUNT', 'VARIABLE'),
      system('OPENING_EQUITY', 'OPENING_EQUITY', 'VARIABLE', 0, 1),
      system('MIGRATION_EQUITY', 'MIGRATION_EQUITY', 'VARIABLE', 0, 1)
    ]
  },
  { code: 'ACCUMULATION_OPENING', roles: [] },
  { code: 'INCOME', roles: [user('TARGET', 'POSITIVE'), system('INCOME_CLEARING', 'INCOME_CLEARING', 'NEGATIVE')] },
  { code: 'EXPENSE', roles: [user('SOURCE', 'NEGATIVE'), system('EXPENSE_CLEARING', 'EXPENSE_CLEARING', 'POSITIVE')] },
  { code: 'TRANSFER', roles: [user('SOURCE', 'NEGATIVE'), user('TARGET', 'POSITIVE')] },
  {
    code: 'CONTRIBUTION_OUT',
    roles: [user('SOURCE', 'NEGATIVE'), system('INTERSPACE_CLEARING_OUT', 'INTERSPACE_CLEARING', 'POSITIVE')]
  },
  {
    code: 'CONTRIBUTION_IN',
    roles: [system('INTERSPACE_CLEARING_IN', 'INTERSPACE_CLEARING', 'NEGATIVE'), user('TARGET', 'POSITIVE')]
  },
  {
    code: 'LOAN_DISBURSEMENT',
    roles: [user('CASH_SOURCE', 'NEGATIVE'), system('LOAN_RECEIVABLE', 'LOAN_RECEIVABLE', 'POSITIVE')]
  },
  {
    code: 'BORROWING',
    roles: [user('CASH_TARGET', 'POSITIVE'), system('BORROWING_LIABILITY', 'BORROWING_LIABILITY', 'NEGATIVE')]
  },
  {
    code: 'REPAYMENT',
    roles: [user('CASH_SOURCE', 'NEGATIVE'), system('BORROWING_LIABILITY', 'BORROWING_LIABILITY', 'POSITIVE')]
  },
  {
    code: 'COLLECTION',
    roles: [user('CASH_TARGET', 'POSITIVE'), system('LOAN_RECEIVABLE', 'LOAN_RECEIVABLE', 'NEGATIVE')]
  },
  { code: 'ACCUMULATION_CLOSE', roles: [user('ACCUMULATION_SOURCE', 'NEGATIVE'), user('TARGET', 'POSITIVE')] },
  { code: 'SAVING_DEPOSIT', roles: [user('SOURCE', 'NEGATIVE'), user('SAVING_TARGET', 'POSITIVE')] },
  {
    code: 'SAVING_INTEREST_MONTHLY',
    roles: [
      system('INTEREST_EXPENSE', 'INTEREST_EXPENSE', 'NEGATIVE'),
      user('SAVING_INTEREST_CREDIT', 'POSITIVE'),
      user('SAVING_PAYOUT', 'NEGATIVE'),
      user('INTEREST_TARGET', 'POSITIVE')
    ]
  },
  {
    code: 'SAVING_INTEREST_MATURITY',
    roles: [
      system('INTEREST_EXPENSE', 'INTEREST_EXPENSE', 'NEGATIVE'),
      user('SAVING_INTEREST_CREDIT', 'POSITIVE'),
      user('SAVING_PAYOUT', 'NEGATIVE', 0, 1),
      user('INTEREST_TARGET', 'POSITIVE', 0, 1)
    ]
  },
  {
    code: 'SAVING_CLOSE',
    roles: [
      system('INTEREST_EXPENSE', 'INTEREST_EXPENSE', 'NEGATIVE', 0, 1),
      user('SAVING_INTEREST_CREDIT', 'POSITIVE', 0, 1),
      user('SAVING_SOURCE', 'NEGATIVE'),
      user('TARGET', 'POSITIVE')
    ]
  },
  { code: 'SAVING_ROLLOVER_PRINCIPAL', roles: [user('OLD_SAVING', 'NEGATIVE'), user('NEW_SAVING', 'POSITIVE')] },
  {
    code: 'SAVING_ROLLOVER_PRINCIPAL_INTEREST',
    roles: [
      system('INTEREST_EXPENSE', 'INTEREST_EXPENSE', 'NEGATIVE'),
      user('OLD_SAVING_INTEREST_CREDIT', 'POSITIVE'),
      user('OLD_SAVING', 'NEGATIVE'),
      user('NEW_SAVING', 'POSITIVE')
    ]
  }
]

const canonicalTemplate = (template: (typeof templates)[number]) => ({
  code: template.code,
  version: 1,
  roles: [...template.roles]
    .sort((left, right) => left.entryRole.localeCompare(right.entryRole))
    .map((role) => ({
      accountKind: role.accountKind,
      entryRole: role.entryRole,
      maximum: role.maximum ?? 1,
      minimum: role.minimum ?? 1,
      sign: role.sign,
      systemRole: role.systemRole ?? null
    }))
})

const definitionHash = (template: (typeof templates)[number]) =>
  createHash('sha256').update(JSON.stringify(canonicalTemplate(template))).digest('hex')

const run = async () => {
  await prisma.$transaction(async (transaction) => {
    await transaction.system_account_definitions.createMany({
      data: systemAccounts.map(([code, normalSide, allowsNegativeBalance, description]) => ({
        code,
        normal_side: normalSide,
        allows_negative_balance: allowsNegativeBalance,
        description
      })),
      skipDuplicates: true
    })

    const actualSystemAccounts = await transaction.system_account_definitions.findMany({ orderBy: { code: 'asc' } })
    if (actualSystemAccounts.length !== systemAccounts.length) {
      throw new Error(`Expected ${systemAccounts.length} system account definitions, found ${actualSystemAccounts.length}`)
    }
    for (const [code, normalSide, allowsNegativeBalance, description] of systemAccounts) {
      const actual = actualSystemAccounts.find((entry) => entry.code === code)
      if (
        !actual ||
        actual.normal_side !== normalSide ||
        actual.allows_negative_balance !== allowsNegativeBalance ||
        actual.description !== description ||
        !actual.is_active
      ) {
        throw new Error(`Existing system account definition ${code} differs from the approved seed`)
      }
    }

    for (const template of templates) {
      const hash = definitionHash(template)
      const existing = await transaction.posting_template_definitions.findUnique({
        where: { code_version: { code: template.code, version: 1 } }
      })
      if (existing && (existing.definition_hash !== hash || existing.status !== 'APPROVED')) {
        throw new Error(`Existing posting template ${template.code}@1 differs from the approved seed`)
      }
      const definition =
        existing ??
        (await transaction.posting_template_definitions.create({
          data: {
            code: template.code,
            version: 1,
            status: 'APPROVED',
            definition_hash: hash,
            effective_at: effectiveAt
          }
        }))

      await transaction.posting_template_entry_roles.createMany({
        data: template.roles.map((role) => ({
          posting_template_definition_id: definition.id,
          entry_role: role.entryRole,
          required_account_kind: role.accountKind,
          required_system_role: role.systemRole,
          sign_rule: role.sign,
          minimum_occurrences: role.minimum ?? 1,
          maximum_occurrences: role.maximum ?? 1
        })),
        skipDuplicates: true
      })

      const actualRoles = await transaction.posting_template_entry_roles.findMany({
        where: { posting_template_definition_id: definition.id },
        orderBy: { entry_role: 'asc' }
      })
      const expectedRoles = canonicalTemplate(template).roles
      const normalizedActual = actualRoles.map((role) => ({
        accountKind: role.required_account_kind,
        entryRole: role.entry_role,
        maximum: role.maximum_occurrences,
        minimum: role.minimum_occurrences,
        sign: role.sign_rule,
        systemRole: role.required_system_role
      }))
      if (JSON.stringify(normalizedActual) !== JSON.stringify(expectedRoles)) {
        throw new Error(`Existing entry roles for ${template.code}@1 differ from the approved seed`)
      }
    }
  })

  const [definitionCount, approvedDefinitionCount, roleCount] = await Promise.all([
    prisma.posting_template_definitions.count(),
    prisma.posting_template_definitions.count({ where: { status: 'APPROVED' } }),
    prisma.posting_template_entry_roles.count()
  ])
  const expectedRoleCount = templates.reduce((count, template) => count + template.roles.length, 0)
  if (definitionCount !== templates.length || approvedDefinitionCount !== templates.length) {
    throw new Error(
      `Expected ${templates.length} approved physical templates, found ${approvedDefinitionCount}/${definitionCount}`
    )
  }
  if (roleCount !== expectedRoleCount) {
    throw new Error(`Expected ${expectedRoleCount} posting entry roles, found ${roleCount}`)
  }
  process.stdout.write(
    `Wave 2 system seed PASS: system_definitions=${systemAccounts.length}, physical_templates=${templates.length}, entry_roles=${roleCount}, business_templates=17\n`
  )
}

run()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
