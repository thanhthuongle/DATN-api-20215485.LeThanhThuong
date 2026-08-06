export const toAccountResponse = (a) => ({
  publicId: a.public_id,
  name: a.name,
  type: a.type,
  status: a.status,
  icon: a.icon,
  bankId: a.banks?.public_id || null,
  balance: a.ledger_accounts?.current_balance?.toString() || '0',
  createdAt: a.created_at?.toISOString()
})

export const toAccountListResponse = (accounts) => accounts.map(toAccountResponse)
