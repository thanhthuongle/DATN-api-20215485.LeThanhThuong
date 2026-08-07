import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'

class NotificationRepository {
  async findByUser(userId, limit = 20) {
    const prisma = getPrismaClient()
    return prisma.user_notifications.findMany({
      where: { user_id: userId, deleted_at: null },
      include: { notifications: true },
      orderBy: { received_at: 'desc' },
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

  async findUserNotificationByPublicId(userNotificationId) {
    const prisma = getPrismaClient()
    return prisma.user_notifications.findFirst({
      where: { public_id: userNotificationId, deleted_at: null },
      include: { notifications: true }
    })
  }

  async markReaded(userId, userNotificationId) {
    const prisma = getPrismaClient()
    return prisma.user_notifications.updateMany({
      where: { user_id: userId, public_id: userNotificationId, deleted_at: null },
      data: { is_read: true, read_at: new Date() }
    })
  }
}

const notificationRepository = new NotificationRepository()
export default notificationRepository
export { NotificationRepository }
