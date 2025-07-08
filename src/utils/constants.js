import { env } from '~/config/environment'

export const WHITELIST_DOMAINS = [
  'https://hey-money.vercel.app',
  'https://hey-money-git-master-su-gia-hoa-binhs-projects-a8f56a9c.vercel.app',
  'https://hey-money-g32xbngkz-su-gia-hoa-binhs-projects-a8f56a9c.vercel.app'
]

export const OWNER_TYPE = {
  INDIVIDUAL: 'individual',
  FAMILY: 'family'
}

export const MONEY_SOURCE_TYPE = {
  ACCOUNT: 'account',
  SAVINGS_ACCOUNT: 'savings_account',
  ACCUMULATION: 'accumulation'
}

export const INTEREST_PAID = {
  MATURITY: 'maturity',
  // UP_FRONT: 'up_front',
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
  COLLECT: 'collect',
  BORROWING: 'borrowing',
  REPAYMENT: 'repayment',
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

export const ACCOUNT_TYPES = {
  WALLET: 'wallet',
  BANK: 'bank',
  OTHER: 'orther'
}

export const LANGUAGES = {
  VIE: 'Tiếng Việt'
}

export const CURRENCIES = {
  VND: 'VND'
}

export const AGENDA_NOTIFICATION_TYPES = {
  NOTICE: 'notice', // Thông báo text thông thường
  NOTE: 'note', // Nhắc nhở ghi chép mỗi ngày
  COLLECTION: 'collection', // Nhắc nhở đến lịch thu nợ
  REPAYMENT: 'repayment', // Nhắc nhở đến lịch trả nợ
  MONTHLY_SAVING_SOLVER: 'monthly_saving_solver', // Tự động xử lý sổ tiết kiệm hàng tháng
  MATURITY_SAVING_SOLVER: 'maturity_saving_solver', // Tự động xử lý sổ tiết kiệm cuối kỳ
  AUTO_ROLL_OVER_PRINCIPAL: 'auto_roll_over_principal', // Thông báo tự động tái tục gốc
  AUTO_ROLL_OVER_PRINCIPAL_AND_INTEREST: 'auto_roll_over_principal_and_interest', // Thông báo tự động tái tục gốc và lãi
  RECEIVE_INTEREST: 'receive_interest', // Nhận lãi suất sổ tiết kiệm định kỳ
  CLOSE_SAVING: 'close_saving', // Nhắc nhở tất toán sổ tiết kiệm đến kỳ hạn
  OVER_BUDGET: 'over_budget' // chi quá ngân sách thiết lập
}

export const TRUST_LEVEL_CONTACT = {
  NORMAL: 'normal',
  GOOD: 'good',
  WARNING: 'warning',
  BAD: 'bad'
}

export const WEBSITE_DOMAIN = env.BUILD_MODE === 'production' ? env.WEBSITE_DOMAIN_PRODUCTION : env.WEBSITE_DOMAIN_DEVELOPMENT
