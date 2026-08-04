import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'

class ContactRepository {
  async findBySpace(spaceId) {
    const prisma = getPrismaClient()
    return prisma.contacts.findMany({
      where: { financial_space_id: spaceId, deleted_at: null },
      orderBy: { name: 'asc' }
    })
  }

  async create(data) {
    const prisma = getPrismaClient()
    return prisma.contacts.create({ data })
  }

  async findByPublicId(publicId) {
    const prisma = getPrismaClient()
    return prisma.contacts.findFirst({ where: { public_id: publicId, deleted_at: null } })
  }

  async update(publicId, data) {
    const prisma = getPrismaClient()
    return prisma.contacts.update({ where: { public_id: publicId }, data })
  }

  async softDelete(publicId) {
    const prisma = getPrismaClient()
    return prisma.contacts.update({
      where: { public_id: publicId },
      data: { deleted_at: new Date() }
    })
  }
}

const contactRepository = new ContactRepository()
export default contactRepository
export { ContactRepository }
