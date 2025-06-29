/* eslint-disable no-console */
import moment from 'moment'
import { ObjectId } from 'mongodb'
import { bankModel } from '~/models/bankModel'
import { savingsAccountModel } from '~/models/savingsAccountModel'
import { userModel } from '~/models/userModel'
import { savingService } from '~/services/savingService'
import { AGENDA_NOTIFICATION_TYPES, TERM_ENDED } from '~/utils/constants'

module.exports = (agenda) => {
  agenda.define('maturity_saving_solver', async (job) => {
    try {
      const { userId, savingId } = job.attrs.data

      // Kiểm tra userId
      const user = await userModel.findOneById(userId)
      if (!user) {
        console.error(`[maturity_saving_solver] Không tìm thấy userId: ${userId.toString()}.`)
        return
      }

      // Kiểm tra savingId
      const saving = await savingsAccountModel.findOneById(savingId)
      if (!saving) {
        console.error(`[maturity_saving_solver] Không tìm thấy savingId: ${savingId.toString()}.`)
        return
      } else if (saving?.ownerId?.toString() != userId.toString()) {
        console.error(`[maturity_saving_solver] userId: ${userId.toString()} không có quyền truy cập savingId: ${savingId.toString()}!`)
        return
      } else if (saving?.isClosed == true) {
        console.error(`[maturity_saving_solver] Sổ tiết kiệm: ${saving.savingsAccountName} với ID: ${savingId.toString()} đã tất toán!`)
        return
      }

      const maturityDate = moment(saving?.startDate).add(saving?.term, 'months').toISOString()
      if (moment().isSameOrAfter(moment(maturityDate))) { // Nếu thời gian hiện tại đã qua thời gian đáo hạn thì sẽ thực hiện hành động tương ứng khi đến kỳ hạn
        const bank = await bankModel.findOneById(saving.bankId)

        if (saving?.termEnded == TERM_ENDED.CLOSE_ACCOUNT) { // Nếu sổ tiết kiệm được cài đặt tất toán khi đến hạn thì nhắc người dùng qua thông báo
          // Nhắc nhở người dùng thực hiện tất toán sổ thủ công
          const remindData = {
            jobType: AGENDA_NOTIFICATION_TYPES.CLOSE_SAVING,
            savingId: saving._id,
            userId: new ObjectId(userId),
            title: 'Nhắc tất toán',
            message: `Bạn có sổ tiết kiệm <strong>${saving?.savingsAccountName}</strong> tại ngân hàng <strong>${bank?.name}</strong> đã đến hạn tất toán.`
          }
          await agenda.now('send_reminder', remindData)
        } else if (saving?.termEnded == TERM_ENDED.ROLL_OVER_PRINCIPAL) { // Nếu sổ tiết kiệm cài đặt là tái tục thì thực hiện tái tục gốc và nhận lãi tự động
          // Nhận lãi tự động
          await savingService.receiveMaturityInterest(user._id, saving._id)

          // Tái tục gốc tự động
          const newSaving = await savingService.rollOverPrincipal(user._id, saving._id)

          //Gửi thông báo nếu tái tục thành công
          if (newSaving) {
            const remindData = {
              jobType: AGENDA_NOTIFICATION_TYPES.AUTO_ROLL_OVER_PRINCIPAL,
              savingId: saving._id,
              userId: new ObjectId(userId),
              title: 'Tái tục tự động',
              message: `Sổ tiết kiệm <strong>${saving?.savingsAccountName}</strong> tại ngân hàng <strong>${bank?.name}</strong> đã tự động tái tục gốc.`
            }
            await agenda.now('send_reminder', remindData)
          }
        } else if (saving?.termEnded == TERM_ENDED.ROLL_OVER_PRINCIPAL_AND_INTEREST) { // Nếu sổ tiết kiệm cài đặt là tái tục gốc và lãi thì tái tục toàn bộ tiền
          // Tái tục cả gốc và lãi tự động
          const newSaving = await savingService.rollOverPrincipalAndInterest(user._id, saving._id)

          //Gửi thông báo nếu tái tục thành công
          if (newSaving) {
            const remindData = {
              jobType: AGENDA_NOTIFICATION_TYPES.AUTO_ROLL_OVER_PRINCIPAL_AND_INTEREST,
              savingId: saving._id,
              userId: new ObjectId(userId),
              title: 'Tái tục tự động',
              message: `Sổ tiết kiệm <strong>${saving?.savingsAccountName}</strong> tại ngân hàng <strong>${bank?.name}</strong> đã tự động tái tục gốc và lãi.`
            }
            await agenda.now('send_reminder', remindData)
          }
        }
      } else { // Nếu mà chưa đến kỳ hạn thì chúng ta lên lịch agenda để xử lý trong tương lai
        const runAt = moment.utc(saving?.startDate).add(saving?.term, 'months').add(7, 'hours').toISOString() // Chạy sau 7 tiếng đến kỳ hạn
        await agenda.schedule(runAt, 'maturity_saving_solver', {
          jobType: AGENDA_NOTIFICATION_TYPES.MATURITY_SAVING_SOLVER,
          userId: user._id,
          savingId: saving._id
        })
      }

    } catch (error) {
      console.error('[maturity_saving_solver] lỗi:', error)
    }
  })
}
