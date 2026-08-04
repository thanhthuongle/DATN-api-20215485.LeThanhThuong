import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'

class NotificationRepository {
  async findByUser(userId, limit = 20) {
    const prisma = getPrismaClient()
    return prisma.user_notifications.findMany({
      where: { user_id: userId },
      include: { notifications: true },
      orderBy: { created_at: 'desc' },
      take: limit
    })
  }

  async create(data) {
    const prisma = getPrismaClient()
    return prisma.notifications.create({ data })
  }

  async createUserNotification(data) {
    const prisma = getPrismaClient()
    return prisma.user_notifications.create({ data })
  }
}

const notificationRepository = new NotificationRepository()
export default notificationRepository
export { NotificationRepository }
