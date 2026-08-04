import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'

/**
 * BankRepository — data access for banks (read-only).
 * Dùng application Prisma client (không cần TransactionContext vì chỉ đọc).
 */
class BankRepository {
  /**
   * Get all active banks.
   * @returns {Promise<object[]>}
   */
  async findAll() {
    const prisma = getPrismaClient()
    return prisma.banks.findMany({
      where: { deleted_at: null },
      orderBy: { name: 'asc' }
    })
  }

  /**
   * Get bank by public_id.
   * @param {string} publicId
   * @returns {Promise<object|null>}
   */
  async findByPublicId(publicId) {
    const prisma = getPrismaClient()
    return prisma.banks.findFirst({
      where: { public_id: publicId, deleted_at: null }
    })
  }

  /**
   * Get bank by internal id.
   * @param {bigint} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    const prisma = getPrismaClient()
    return prisma.banks.findFirst({
      where: { id, deleted_at: null }
    })
  }
}

const bankRepository = new BankRepository()
export default bankRepository
export { BankRepository }
