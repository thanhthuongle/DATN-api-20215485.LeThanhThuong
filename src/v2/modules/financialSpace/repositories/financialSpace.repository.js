import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'

class FinancialSpaceRepository {
  async findByUserId(userId) {
    const prisma = getPrismaClient()
    return prisma.financial_space_memberships.findMany({
      where: { user_id: userId, status: 'ACTIVE' },
      include: { financial_spaces: true }
    })
  }

  async findById(id) {
    const prisma = getPrismaClient()
    return prisma.financial_spaces.findUnique({ where: { id } })
  }

  async findByPublicId(publicId) {
    const prisma = getPrismaClient()
    return prisma.financial_spaces.findUnique({ where: { public_id: publicId } })
  }

  async create(data) {
    const prisma = getPrismaClient()
    return prisma.financial_spaces.create({ data })
  }

  async update(publicId, data) {
    const prisma = getPrismaClient()
    return prisma.financial_spaces.update({ where: { public_id: publicId }, data })
  }
}

const financialSpaceRepository = new FinancialSpaceRepository()
export default financialSpaceRepository
export { FinancialSpaceRepository }
