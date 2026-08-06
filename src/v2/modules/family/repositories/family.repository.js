import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'

class FamilyRepository {
  async findById(id) {
    const prisma = getPrismaClient()
    return prisma.financial_spaces.findFirst({ where: { id, kind: 'FAMILY' } })
  }

  async findByPublicId(publicId) {
    const prisma = getPrismaClient()
    return prisma.financial_spaces.findFirst({ where: { public_id: publicId, kind: 'FAMILY' } })
  }

  async findByOwnerId(userId) {
    const prisma = getPrismaClient()
    const memberships = await prisma.financial_space_memberships.findMany({
      where: { user_id: userId, role: 'OWNER', status: 'ACTIVE' },
      include: { financial_spaces: true }
    })
    return memberships.filter(m => m.financial_spaces?.kind === 'FAMILY').map(m => m.financial_spaces)
  }

  async getMembers(familyId) {
    const prisma = getPrismaClient()
    return prisma.financial_space_memberships.findMany({
      where: { financial_space_id: familyId, status: 'ACTIVE' },
      include: { users: true }
    })
  }
}

const familyRepository = new FamilyRepository()
export default familyRepository
export { FamilyRepository }
