import { env } from '~/config/environment'

export const WHITELIST_DOMAINS = [

]

export const OWNER_TYPE = {
  INDIVIDUAL: 'individual',
  FAMILY: 'family'
}

export const MONEY_SOURCE_TYPE = {
  WALLET: 'wallet',
  SAVINGS_ACCOUNT: 'savings_account',
  ACCUMULATION: 'accumulation'
}

export const INTEREST_PAID = {
  MATURITY: 'maturity',
  UP_FRONT: 'up_front',
  MONTHLY: 'monthly'
}

export const TERM_ENDED = {
  ROLL_OVER_PRINCIPAL_AND_INTEREST: 'roll_over_principal_and_interest',
  ROLL_OVER_PRINCIPAL: 'roll_over_principal',
  CLOSE_ACCOUNT: 'close_account'
}

export const TRANSACTION_TYPES = {
  EXPENSE: 'expense',
  INCOME: 'income',
  LOAN: 'loan',
  BORROWING: 'borrowing',
  TRANSFER: 'transfer',
  CONTRIBUTION: 'contribution'
}

export const PROPOSAL_EXPENSE_STATUS = {
  WAITING: 'waiting',
  APPROVED: 'approved',
  REJECTED: 'rejected'
}

export const INVITATION_STATUS = {
  WAITING: 'waiting',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected'
}

export const NOTIFICATION_TYPES = {
  LINK: 'link',
  TEXT: 'text',
  INVITATION: 'invitation'
}

export const SYSTEM_TASK_TYPE = {
  REMINDER: 'reminder',
  BUDGET_REPEAT: 'budget_repeat'
}

export const WEBSITE_DOMAIN = env.BUILD_MODE === 'production' ? env.WEBSITE_DOMAIN_PRODUCTION : env.WEBSITE_DOMAIN_DEVELOPMENT
