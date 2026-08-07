import notificationRepository from '../repositories/notification.repository'

class NotificationService {
  async getByUser(userId, limit = 20) {
    return notificationRepository.findByUser(userId, limit)
  }

  async getNotifications(userId, limit = 20) {
    return notificationRepository.findByUser(userId, limit)
  }

  async create({ type, title, body, link }) {
    return notificationRepository.create({
      type,
      title,
      message: body,
      link: link || null
    })
  }

  async notifyUser({ notificationId, userId }) {
    return notificationRepository.createUserNotification({
      notification_id: notificationId,
      user_id: userId,
      is_read: false,
      received_at: new Date()
    })
  }

  async markReaded(userId, userNotificationId) {
    const userNotification = await notificationRepository.findUserNotificationByPublicId(userNotificationId)
    if (!userNotification) {
      const error = new Error('Thông báo không tồn tại')
      error.statusCode = 404
      throw error
    }

    if (userNotification.user_id !== userId) {
      const error = new Error('Không có quyền truy cập thông báo này!')
      error.statusCode = 403
      throw error
    }

    if (userNotification.is_read) {
      const error = new Error('Thông báo đã đánh dấu đã đọc')
      error.statusCode = 409
      throw error
    }

    await notificationRepository.markReaded(userId, userNotificationId)
    return notificationRepository.findUserNotificationByPublicId(userNotificationId)
  }
}

const notificationService = new NotificationService()
export default notificationService
export { NotificationService }

