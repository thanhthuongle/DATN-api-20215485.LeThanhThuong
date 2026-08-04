import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'

class UserRepository {
  async findByEmail(email) {
    const prisma = getPrismaClient()
    return prisma.users.findFirst({ where: { email, deleted_at: null } })
  }

  async findByPublicId(publicId) {
    const prisma = getPrismaClient()
    return prisma.users.findFirst({ where: { public_id: publicId, deleted_at: null } })
  }

  async create(data) {
    const prisma = getPrismaClient()
    return prisma.users.create({ data })
  }

  async update(publicId, data) {
    const prisma = getPrismaClient()
    return prisma.users.update({ where: { public_id: publicId }, data })
  }
}

const userRepository = new UserRepository()
export default userRepository
export { UserRepository }
