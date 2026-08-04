import notificationRepository from '../repositories/notification.repository'

class NotificationService {
  async getByUser(userId, limit = 20) {
    return notificationRepository.findByUser(userId, limit)
  }

  async create({ type, title, body, link, createdBy }) {
    return notificationRepository.create({
      type,
      title,
      body,
      link: link || null,
      created_by: createdBy
    })
  }

  async notifyUser({ notificationId, userId }) {
    return notificationRepository.createUserNotification({
      notification_id: notificationId,
      user_id: userId,
      is_read: false
    })
  }
}

const notificationService = new NotificationService()
export default notificationService
export { NotificationService }
