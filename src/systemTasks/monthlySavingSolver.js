/* eslint-disable no-console */
import moment from 'moment'
import { ObjectId } from 'mongodb'
import { bankModel } from '~/models/bankModel'
import { savingsAccountModel } from '~/models/savingsAccountModel'
import { userModel } from '~/models/userModel'
import { savingService } from '~/services/savingService'
import { AGENDA_NOTIFICATION_TYPES, TERM_ENDED } from '~/utils/constants'

const handleWhenMaturity = async (agenda, userId, savingId, saving) => {
  const bank = await bankModel.findOneById(saving.bankId)
  if (saving?.termEnded == TERM_ENDED.CLOSE_ACCOUNT) {
  // Nhắc nhở người dùng thực hiện tất toán sổ thủ công
    const remindData = {
      jobType: AGENDA_NOTIFICATION_TYPES.CLOSE_SAVING,
      savingId: saving._id,
      userId: new ObjectId(userId),
      title: 'Nhắc tất toán',
      message: `Bạn có sổ tiết kiệm <strong>${saving?.savingsAccountName}</strong> tại ngân hàng <strong>${bank?.name}</strong> đã đến hạn tất toán.`
    }
    await agenda.now('send_reminder', remindData)
  } else if (saving?.termEnded == TERM_ENDED.ROLL_OVER_PRINCIPAL) {
    // Thực hiện tái tục gốc với sổ tiết kiệm
    const newSaving = await savingService.rollOverPrincipal(userId, savingId)

    // Thông báo đã tất toán sổ tiết kiệm
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
  }
}

module.exports = (agenda) => {
  agenda.define('monthly_saving_solver', async (job) => {
    try {
      const { userId, savingId, stt } = job.attrs.data

      // Kiểm tra userId
      const user = await userModel.findOneById(userId)
      if (!user) {
        console.error(`[monthly_saving_solver] Không tìm thấy userId: ${userId.toString()}.`)
        return
      }

      // Kiểm tra savingId
      const saving = await savingsAccountModel.findOneById(savingId)
      if (!saving) {
        console.error(`[monthly_saving_solver] Không tìm thấy savingId: ${savingId.toString()}.`)
        return
      } else if (saving?.ownerId?.toString() != userId.toString()) {
        console.error(`[monthly_saving_solver] userId: ${userId.toString()} không có quyền truy cập savingId: ${savingId.toString()}!`)
        return
      } else if (saving?.isClosed == true) {
        console.error(`[monthly_saving_solver] Sổ tiết kiệm: ${saving.savingsAccountName} với ID: ${savingId.toString()} đã tất toán!`)
        return
      }

      if (stt > saving?.term) return

      if (stt == 0) {
        let sttSchedule
        for (let i = 1; i <= saving?.term; i++) {
          const runAt = moment(saving?.startDate).add(i, 'months').set({ hour: 7, minute: 0, second: 0, millisecond: 0 }).toISOString()
          sttSchedule = i
          if (moment(runAt).isSameOrBefore(moment())) {
            // Tự động thu lãi
            await savingService.receiveMonthlyInterest(userId, savingId, sttSchedule)

            // Đến kỳ hạn
            if (sttSchedule == saving?.term) {
              await handleWhenMaturity(agenda, userId, savingId, saving)
            }
          } else {
            await agenda.schedule(runAt, 'monthly_saving_solver', {
              jobType: AGENDA_NOTIFICATION_TYPES.MONTHLY_SAVING_SOLVER,
              userId,
              savingId,
              stt: sttSchedule
            })
            return
          }
        }
      } else {
        // Tự động thu lãi
        await savingService.receiveMonthlyInterest(userId, savingId, stt)
        await agenda.now('send_reminder', {
          jobType: AGENDA_NOTIFICATION_TYPES.NOTICE,
          userId,
          title: 'Thu lãi tự động',
          message: `Đã thực hiện thu lãi tự động tháng thứ ${stt} cho sổ tiết kiệm: ${saving?.savingsAccountName}.`
        })

        // Nếu chưa đến hạn thì tiếp tục tạo lịch cho tháng tiếp theo
        if (stt < saving?.term) {
          const nextRunTime = moment(saving?.startDate).add(stt+1, 'months').set({ hour: 7, minute: 0, second: 0, millisecond: 0 }).toISOString()
          await agenda.schedule(nextRunTime, 'monthly_saving_solver', {
            jobType: AGENDA_NOTIFICATION_TYPES.MONTHLY_SAVING_SOLVER,
            userId,
            savingId,
            stt: stt+1
          })

        }
        // Nếu là lần cuối nhận lãi thì nhắc đóng sổ tiết kiệm và tái tục sổ nếu có
        if (stt == saving?.term) {
          await handleWhenMaturity(agenda, userId, savingId, saving)
        }
      }

    } catch (error) {
      console.error('[monthly_saving_solver] lỗi:', error)
    }
  })
}
