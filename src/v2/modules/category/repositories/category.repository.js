import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'

class CategoryRepository {
  async findBySpace(spaceId) {
    const prisma = getPrismaClient()
    return prisma.categories.findMany({
      where: { financial_space_id: spaceId, deleted_at: null },
      orderBy: { created_at: 'asc' }
    })
  }

  async findBySpaceAndType(spaceId, transactionType) {
    const prisma = getPrismaClient()
    return prisma.categories.findMany({
      where: {
        financial_space_id: spaceId,
        transaction_type: transactionType,
        deleted_at: null
      },
      orderBy: { created_at: 'asc' }
    })
  }

  async create(data) {
    const prisma = getPrismaClient()
    return prisma.categories.create({ data })
  }

  async findByPublicId(publicId) {
    const prisma = getPrismaClient()
    return prisma.categories.findFirst({ where: { public_id: publicId, deleted_at: null } })
  }
}

const categoryRepository = new CategoryRepository()
export default categoryRepository
export { CategoryRepository }
