/* eslint-disable no-console */
import moment from 'moment'
import { savingsAccountModel } from '~/models/savingsAccountModel'
import { userModel } from '~/models/userModel'
import { savingService } from '~/services/savingService'

module.exports = (agenda) => {
  agenda.define('receive_interest', async (job) => {
    try {
      const { userId, savingId } = job.attrs.data

      // Kiểm tra userId
      const user = userModel.findOneById(userId)
      if (!user) {
        console.log(`thu lãi sổ tiết kiệm tự động qua agenda với userId: ${userId.toString()} không tồn tại!`)
        return
      }

      // Kiểm tra savingId
      const saving = savingsAccountModel.findOneById(savingId)
      if (!saving) {
        console.log(`thu lãi sổ tiết kiệm tự động qua agenda với savingId: ${savingId.toString()} không tồn tại!`)
        return
      } else if (saving?.ownerId?.toString() != userId.toString()) {
        console.log(`thu lãi sổ tiết kiệm tự động qua agenda vớiuserId: ${userId.toString()} không có quyền truy cập savingId: ${savingId.toString()}!`)
        return
      } else if (saving?.isClosed == true) {
        console.log(`Thu lãi tự động qua agenda với sổ tiết kiệm: ${saving.savingsAccountName} đã tất toán!`)
        return
      }

      const maturityDate = moment(saving.startDate).clone().add(saving.term, 'months').toISOString()
      const lastValidDate = moment(maturityDate).add(5, 'days')
      // Ngày thu lãi hàng tháng ko quá 5 ngày so với ngày gửi tương ứng và ko quá 5 ngày với ngày đáo hạn
      if (moment().isAfter(lastValidDate)) {
        console.log('Thu nợ tự động với sổ tiết kiệm: ${saving.savingsAccountName} quá hạn => xóa job!')
        await agenda.cancel({
          name: 'receive_interest',
          'data.savingId': saving._id,
          nextRunAt: { $ne: null } // chỉ job nào còn lịch chạy sắp tới
        })
        return
      }

      // Thực hiện thu lãi
      await savingService.receiveInterest(userId, savingId)
    } catch (error) {
      console.error('Thực hiện thu lãi suất sổ tiết kiệm tự động lỗi:', error)
    }
  })
}