/* eslint-disable no-console */
import { ObjectId } from 'mongodb'
import { transactionModel } from '~/models/transactionModel'
import { userModel } from '~/models/userModel'
import { notificationService } from '~/services/notificationService'
import { AGENDA_NOTIFICATION_TYPES, OWNER_TYPE } from '~/utils/constants'

module.exports = (agenda) => {
  agenda.define('send_reminder', async (job) => {
    try {
      const { userId, title, message } = job.attrs.data

      // Kiểm tra userId
      const user = userModel.findOneById(userId)
      if (!user) {
        console.error(`[send_reminder] Không tìm thấy userId: ${userId.toString()}!`)
        return
      }

      // Nếu loại thông báo là NOTE
      if (job.attrs.data?.jobType && job.attrs.data?.jobType == AGENDA_NOTIFICATION_TYPES.NOTE) {
        // kiểm tra người dùng đã thực hiện ghi chép gì chưa
        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)
        const filter = {
          ownerType: OWNER_TYPE.INDIVIDUAL,
          ownerId: new ObjectId(userId),
          _destroy: false,
          transactionTime: {
            $gte: startOfToday,
            $lte: new Date()
          }
        }
        const transactionToday = transactionModel.getIndividualTransactions(filter)
        if (Array.isArray(transactionToday) && transactionToday?.length > 0) return //Không gửi thông báo nữa nếu ng dùng đã chủ động thực hiện ghi chép trước giờ nhắc nhở
      }

      const notificationData = { title, message }
      if (job.attrs.data?.link) {
        notificationData.link = job.attrs.data?.link
      }

      // Tạo notification
      const createdNotification = await notificationService.createNew(userId.toString(), notificationData)

      return createdNotification
    } catch (error) {
      console.error('[send_reminder] Tạo thông báo tự động qua agenda lỗi:', error)
    }
  })
}
