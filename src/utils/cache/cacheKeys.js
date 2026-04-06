export const CacheKeys = {
  // Banks
  ALL_BANKS: 'banks:all',
  BANK_BY_ID: (id) => `banks:id:${id}`,

  // Categories
  INDIVIDUAL_CATEGORIES: (userId) => `categories:individual:${userId}`,
  FAMILY_CATEGORIES: (familyId) => `categories:family:${familyId}`,
  INDIVIDUAL_CATEGORIES_TYPE: (userId, type) =>
    `categories:individual:${userId}:type:${type}`,

  // Accounts (future)
  INDIVIDUAL_ACCOUNTS: (userId) => `accounts:individual:${userId}`,
  FAMILY_ACCOUNTS: (familyId) => `accounts:family:${familyId}`
}
