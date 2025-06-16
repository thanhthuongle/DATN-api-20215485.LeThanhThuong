import { notificationService } from '~/services/notificationService'
import { NOTIFICATION_TYPES } from '~/utils/constants'

module.exports = (agenda) => {
  agenda.define('send remider', async (job) => {
    const { userId, title, message } = job.attrs.data

    const notificationData = { title, message }
    if (job.attrs.data?.link) {
      notificationData.type = NOTIFICATION_TYPES.LINK,
      notificationData.link = job.attrs.data?.link
    } else {
      notificationData.type = NOTIFICATION_TYPES.TEXT
    }

    // Tạo notification
    notificationService.createNew(userId, notificationData)

    // Gửi thông báo real-time sau khi có thông báo mới
  })
}
