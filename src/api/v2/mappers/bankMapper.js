/**
 * BankMapper — transforms Prisma bank model to API response.
 */
export const toBankResponse = (bank) => ({
  publicId: bank.public_id,
  name: bank.name,
  shortName: bank.short_name,
  code: bank.code,
  icon: bank.icon,
  color: bank.color,
  createdAt: bank.created_at?.toISOString()
})

export const toBankListResponse = (banks) => banks.map(toBankResponse)
