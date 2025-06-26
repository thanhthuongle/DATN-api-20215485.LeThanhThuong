/* eslint-disable no-console */
/* eslint-disable no-useless-catch */
import { ObjectId } from 'mongodb'
import { MongoClientInstance } from '~/config/mongodb'
import { categoryModel } from '~/models/categoryModel'
import { moneySourceModel } from '~/models/moneySourceModel'
import { savingsAccountModel } from '~/models/savingsAccountModel'
import { AGENDA_NOTIFICATION_TYPES, INTEREST_PAID, MONEY_SOURCE_TYPE, OWNER_TYPE, TERM_ENDED, TRANSACTION_TYPES } from '~/utils/constants'
import { commitWithRetry, runTransactionWithRetry } from '~/utils/mongoTransaction'
import { transactionService } from './transactionService'
import { transactionModel } from '~/models/transactionModel'
import { transferService } from './transferService'
import ApiError from '~/utils/ApiError'
import { StatusCodes } from 'http-status-codes'
import { accountModel } from '~/models/accountModel'
import moment from 'moment'
import { agenda } from '~/agenda/agenda'
import { userModel } from '~/models/userModel'
import { generateNewName } from '~/utils/formatter'
import { bankModel } from '~/models/bankModel'
import { accumulationModel } from '~/models/accumulationModel'

const moneySourceModelHandle = {
  [MONEY_SOURCE_TYPE.ACCOUNT]: accountModel,
  [MONEY_SOURCE_TYPE.ACCUMULATION]: accumulationModel,
  [MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT]: savingsAccountModel
}

function getAccumulationDaysInCurrentMonth(startDate, now) {
  const sentDay = startDate.date()
  let interestStart = now.clone().date(sentDay)
  if (interestStart.isAfter(now)) interestStart = interestStart.subtract(1, 'month')
  return now.diff(interestStart, 'days') + 1
}

function calcInterest(saving) {
  const now = moment()
  const startDate = moment(saving?.startDate)
  let interest = 0

  const isRollOver = [
    TERM_ENDED.ROLL_OVER_PRINCIPAL,
    TERM_ENDED.ROLL_OVER_PRINCIPAL_AND_INTEREST
  ].includes(saving?.termEnded)

  const isMonthly = saving?.interestPaid === INTEREST_PAID.MONTHLY
  const isMaturity = saving?.interestPaid === INTEREST_PAID.MATURITY
  const maturityDate = startDate.clone().add(saving?.term, 'months')
  const isEarly = now.isBefore(maturityDate)

  let accumulationDays = 0

  if (isRollOver || isEarly) {
    if (isMonthly) {
      accumulationDays = getAccumulationDaysInCurrentMonth(startDate, now)
    } else if (isMaturity) {
      accumulationDays = now.diff(startDate, 'days') + 1
    }
    interest = Math.round((saving?.initBalance * saving?.nonTermRate * accumulationDays) / 36500)
  } else {
    // Đúng hạn
    // eslint-disable-next-line no-lonely-if
    if (isMonthly) {
      interest = 0
    } else if (isMaturity) {
      interest = Math.round((saving?.initBalance * saving?.rate * saving?.term) / 1200)
    }
  }

  return interest
}

const createIndividualSaving = async (userId, reqBody, options = {}) => {
  const externalSession = options.session
  const session = externalSession || MongoClientInstance.startSession()

  let result = null
  try {
    result = await runTransactionWithRetry(async (session) => {
      // Nếu dùng session bên ngoài thì không nên gọi startTransaction nữa!
      if (!externalSession) {
        session.startTransaction({
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
          readPreference: 'primary'
        })
      }

      const filter = {
        ownerType: OWNER_TYPE.INDIVIDUAL,
        ownerId: new ObjectId(userId),
        _destroy: false
      }
      let moneySource = await moneySourceModel.findOneRecord(filter, { session })
      if (!moneySource) {
        const newMoneySource = {
          ownerType: OWNER_TYPE.INDIVIDUAL,
          ownerId: userId
        }
        const createdMoneySource = await moneySourceModel.createNew(newMoneySource, { session })
        moneySource = await moneySourceModel.findOneById(createdMoneySource.insertedId, { session })
      }

      // Kiểm tra ngân hàng được hỗ trợ ko
      const bank = await bankModel.findOneById(reqBody?.bankId, { session })
      if (!bank) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Ngân hàng gửi tiền chưa được hỗ trợ!')
      // Kiểm tra tài khoản nguồn tiền gửi tiết kiệm
      const moneySourceModelHandler = moneySourceModelHandle[reqBody?.moneyFromType]
      const moneyFrom = await moneySourceModelHandler.findOneById(reqBody?.moneyFromId, { session })
      if (!moneyFrom || moneyFrom?.ownerId?.toString() != userId?.toString()) throw new ApiError(StatusCodes.BAD_REQUEST, 'Nguồn tiền gửi tiết kiệm không hợp lệ')
      // Kiểm tra tài khoản nhận tiền lãi (nếu có)
      if (reqBody?.interestPaidTargetId) {
        const interestPaidTarget = await accountModel.findOneById(reqBody?.interestPaidTargetId, { session })
        if (!interestPaidTarget || interestPaidTarget?.ownerId?.toString() != userId?.toString()) throw new ApiError(StatusCodes.BAD_REQUEST, 'Tài khoản nhận lãi suất không hợp lệ')
      }

      const data = {
        ownerType: OWNER_TYPE.INDIVIDUAL,
        ownerId: userId.toString(),
        moneySourceId: (moneySource._id).toString(),
        // balance: reqBody.initBalance,
        balance: 0,
        ...reqBody
      }

      const createdSaving = await savingsAccountModel.createNew(data, { session })
      const getNewSaving = await savingsAccountModel.findOneById(createdSaving.insertedId, { session })

      if (getNewSaving) { // Thực hiện chuyển khoản từ nguồn tiền đến sổ tiết kiệm
        await moneySourceModel.pushSavingIds(getNewSaving, { session })
        const transferCategory = await categoryModel.findOneCategory({
          ownerType: OWNER_TYPE.INDIVIDUAL,
          ownerId: new ObjectId(userId),
          _destroy: false,
          type: TRANSACTION_TYPES.TRANSFER
        }, { session })

        const newTransferTransactionData = {
          type: TRANSACTION_TYPES.TRANSFER,
          categoryId: transferCategory._id.toString(),
          name: transferCategory.name,
          description: `Mở sổ tiết kiệm: ${getNewSaving.savingsAccountName}`,
          amount: getNewSaving.initBalance,
          transactionTime: moment(getNewSaving.startDate).toISOString(),
          detailInfo: {
            moneyFromType: getNewSaving.moneyFromType,
            moneyFromId: getNewSaving.moneyFromId.toString(),
            moneyTargetType: MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT,
            moneyTargetId: getNewSaving._id.toString()
          }
        }
        await transactionService.createIndividualTransaction(userId.toString(), newTransferTransactionData, '', { session })
      }

      if (!externalSession) await commitWithRetry(session)
      return getNewSaving
    }, MongoClientInstance, session)

    return result
  } catch (error) {
    if (!externalSession && session.inTransaction()) {
      await session.abortTransaction().catch(() => {})
    }
    throw error
  } finally {
    if (!externalSession) {
      await session.endSession()
      //Tính toán, lên lịch các tác vụ tự động
      if (result) {
        const runAt = moment().add(3, 'seconds').toISOString()
        if (result?.interestPaid == INTEREST_PAID.MONTHLY) {
          await agenda.schedule(runAt, 'monthly_saving_solver', {
            jobType: AGENDA_NOTIFICATION_TYPES.MONTHLY_SAVING_SOLVER,
            userId: new ObjectId(userId),
            savingId: result?._id,
            stt: 0
          })
        } else if (result?.interestPaid == INTEREST_PAID.MATURITY) {
          await agenda.schedule(runAt, 'maturity_saving_solver', {
            jobType: AGENDA_NOTIFICATION_TYPES.MATURITY_SAVING_SOLVER,
            userId: new ObjectId(userId),
            savingId: result?._id
          })
        }
      }
    }
  }
}

const createFamilySaving = async (userId, familyId, reqBody) => {
  const session = MongoClientInstance.startSession()
  try {
    const result = await runTransactionWithRetry(async (session) => {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary'
      })
      const filter = {
        ownerType: OWNER_TYPE.FAMILY,
        ownerId: new ObjectId(familyId),
        _destroy: false
      }
      let moneySource = await moneySourceModel.findOneRecord(filter, { session })
      if (!moneySource) {
        const newMoneySource = {
          ownerType: OWNER_TYPE.FAMILY,
          ownerId: familyId
        }
        const createdMoneySource = await moneySourceModel.createNew(newMoneySource, { session })
        moneySource = await moneySourceModel.findOneById(createdMoneySource.insertedId, { session })
      }

      const data = {
        ownerType: OWNER_TYPE.FAMILY,
        ownerId: familyId,
        moneySourceId: (moneySource._id).toString(),
        balance: reqBody.initBalance,
        ...reqBody
      }

      const createdSaving = await savingsAccountModel.createNew(data, { session })
      const getNewSaving = await savingsAccountModel.findOneById(createdSaving.insertedId, { session })

      if (getNewSaving) {
        await moneySourceModel.pushSavingIds(getNewSaving, { session })
        const transferCategory = await categoryModel.findOneCategory({
          ownerType: OWNER_TYPE.FAMILY,
          ownerId: new ObjectId(familyId),
          _destroy: false,
          type: TRANSACTION_TYPES.TRANSFER
        }, { session })

        const newCommonTransactionData = {
          ownerType: OWNER_TYPE.FAMILY,
          ownerId: familyId,
          responsiblePersonId: userId,
          type: TRANSACTION_TYPES.TRANSFER,
          categoryId: transferCategory._id.toString(),
          name: transferCategory.name,
          description: `Mở sổ tiết kiệm: ${getNewSaving.savingsAccountName}`,
          amount: getNewSaving.initBalance,
          transactionTime: moment(getNewSaving.startDate).toISOString()
        }
        const createdTransaction = await transactionModel.createNew(newCommonTransactionData, { session })

        const newDetailInfoTransactionData = {
          transactionId: createdTransaction.insertedId.toString(),
          moneyFromType: MONEY_SOURCE_TYPE.ACCOUNT,
          moneyFromId: getNewSaving.moneyFromId.toString(),
          moneyTargetType: MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT,
          moneyTargetId: getNewSaving._id.toString()
        }
        await transferService.createNew(getNewSaving.initBalance, newDetailInfoTransactionData, [], { session })

        //TODO: Tính toán, lên lịch các tác vụ tự động
      }

      await commitWithRetry(session)
      return getNewSaving
    }, MongoClientInstance, session)

    return result
  } catch (error) {
    if (session.inTransaction()) { await session.abortTransaction().catch(() => {}) }
    throw error
  } finally {
    await session.endSession()
  }
}

const getIndividualSavings = async (userId) => {
  try {
    const filter = {}
    filter.ownerType = OWNER_TYPE.INDIVIDUAL
    filter.ownerId = new ObjectId(userId)
    filter._destroy = false

    const result = await savingsAccountModel.getSavings(filter)

    return result
  } catch (error) { throw error }
}

const closeSaving = async (userId, savingId, reqBody) => {
  const session = MongoClientInstance.startSession()

  let savingClosed = null
  try {
    savingClosed = await runTransactionWithRetry(async (session) => {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary'
      })

      // Kiểm tra dữ liệu gửi lên
      //Kiểm tra sổ tiết kiệm
      const savingsAccount = await savingsAccountModel.findOneById(savingId, { session })
      if (!savingsAccount) throw new ApiError(StatusCodes.NOT_FOUND, 'Sổ tiết kiệm không tồn tại!')
      //Kiểm tra thông tin nơi nhận tiền sau tất toán
      let moneyTarget
      if (reqBody?.moneyTargetType == MONEY_SOURCE_TYPE.ACCOUNT) {
        moneyTarget = await accountModel.findOneById(reqBody.moneyTargetId, { session })
      } else if (reqBody?.moneyTargetType == MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT) {
        moneyTarget = await savingsAccountModel.findOneById(reqBody.moneyTargetId, { session })
      } else {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Nơi nhận tiền sau tất toán không hỗ trợ!')
      }
      if (!moneyTarget) throw new ApiError(StatusCodes.NOT_FOUND, 'Nơi nhận tiền không tồn tại!')

      // Tính tiền lãi
      const interest = calcInterest(savingsAccount)
      // Tăng số dư cho sổ tiết kiệm để phục vụ cho chuyển khoản
      await savingsAccountModel.increaseBalance(savingId, interest, { session })
      // Chuyển tiền về tài khoản nhận
      const transferCategoryFilter = {
        ownerType: OWNER_TYPE.INDIVIDUAL,
        ownerId: new ObjectId(userId),
        type: TRANSACTION_TYPES.TRANSFER,
        _destroy: false
      }
      const transferCategory = await categoryModel.findOneCategory(transferCategoryFilter, { session })
      const transferData = {
        type: TRANSACTION_TYPES.TRANSFER,
        categoryId: transferCategory._id.toString(),
        name: transferCategory.name,
        description: `Tất toán sổ tiết kiệm: ${savingsAccount.savingsAccountName}`,
        amount: Number(savingsAccount?.balance) + Number(interest),
        transactionTime: new Date(),
        detailInfo: {
          moneyFromType: MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT,
          moneyFromId: savingId,
          moneyTargetType: reqBody.moneyTargetType,
          moneyTargetId: reqBody.moneyTargetId
        }
      }
      await transactionService.createIndividualTransaction(userId, transferData, [], { session })

      // Cập nhật trạng thái và số dư của sổ tiết kiệm
      const updateData = {
        balance: 0,
        isClosed: true
      }
      const savingClosed = await savingsAccountModel.update(savingId, updateData, { session })

      await commitWithRetry(session)
      return savingClosed
    }, MongoClientInstance, session)

    return savingClosed
  } catch (error) {
    if (session.inTransaction()) { await session.abortTransaction().catch(() => {}) }
    throw error
  } finally {
    await session.endSession()
    if (savingClosed) {
      // Xóa các tác vụ agenda của saving tương ứng
      await agenda.cancel({
        savingId: new ObjectId(savingClosed._id)
      })
    }
  }
}

const receiveMonthlyInterest = async (userId, savingId, stt) => {
  try {
    const user = await userModel.findOneById(userId)
    if (!user) throw new ApiError(StatusCodes.NOT_FOUND, `Người dùng ${userId.toString()} ko tồn tại!`)

    const saving = await savingsAccountModel.findOneById(savingId)
    if (!saving) throw new ApiError(StatusCodes.NOT_FOUND, `Sổ tiết kiệm ${savingId.toString()} không tồn tại!`)
    else if (saving?.ownerId?.toString() != userId.toString()) throw new ApiError(StatusCodes.FORBIDDEN, `Người dùng ${userId.toString()} ko có quyền truy cập sổ tiết kiệm ${savingId.toString()}!`)
    else if (saving?.isClosed == true) throw new ApiError(StatusCodes.CONFLICT, `Sổ tiết kiệm ${savingId.toString()} đã tất toán!`)
    else if (saving?.interestPaid != INTEREST_PAID.MONTHLY) throw new ApiError(StatusCodes.BAD_REQUEST, `Sổ tiết kiệm ${savingId.toString()} không thuộc diện nhận lãi hàng tháng!`)
    else if (saving?.term < stt) throw new ApiError(StatusCodes.BAD_REQUEST, `Thu lãi tháng thứ ${stt} vượt kỳ hạn ${saving?.term} tháng`)

    // const maturityDate = moment(saving.startDate).clone().add(saving.term, 'months').toISOString()
    // const lastValidDate = moment(maturityDate).add(5, 'days')
    // Ngày thu lãi hàng tháng ko quá 5 ngày so với ngày gửi tương ứng và ko quá 5 ngày với ngày đáo hạn
    // if (moment().isAfter(lastValidDate)) throw new ApiError(StatusCodes.CONFLICT, `Sổ tiết kiệm ${savingId.toString()} quá hạn để thu lãi suất!`)

    const monthlyInterest = Math.round((saving?.initBalance * saving?.rate) / 1200)
    // Kiểm tra tài khoản nhận lãi, nếu ko có thì mặc định trả về nguồn tiền gửi vào sổ tiết kiệm
    let interestPaidTarget
    interestPaidTarget = await accountModel.findOneById(saving?.interestPaidTargetId)
    if (!interestPaidTarget) {
      console.error(`Không tìm thấy interestPaidTarget có id ${saving?.interestPaidTargetId.toString()} khi thực hiện thu lãi hàng tháng cho sổ tiết kiệm có id ${savingId.toString()}`)
      // Lấy nguồn tiền gửi stk làm nơi nhận tiền mặc định
      interestPaidTarget = await accountModel.findOneById(saving?.moneyFromId)
      if (!interestPaidTarget) {
        console.error(`Không tìm thấy tài khoản gửi sổ tiết kiệm có id ${saving?.moneyFromId.toString()} làm nơi nhận lãi mặc định khi thực hiện thu lãi hàng tháng cho sổ tiết kiệm có id ${savingId.toString()}`)

        throw new ApiError(StatusCodes.NOT_FOUND, `Không tìm thấy nơi nhận lãi khi thực hiện thu lãi hàng tháng cho sổ tiết kiệm có id ${savingId.toString()}`)
      }
    }

    // Tạo giao dịch chuyển khoản từ sổ tiết kiệm về tài khoản nhận tiền
    const transferCategoryFilter = {
      ownerType: OWNER_TYPE.INDIVIDUAL,
      ownerId: new ObjectId(userId),
      _destroy: false,
      type: TRANSACTION_TYPES.TRANSFER
    }
    const transferCategory = await categoryModel.findOneCategory(transferCategoryFilter)
    const transactionData = {
      type: TRANSACTION_TYPES.TRANSFER,
      categoryId: transferCategory._id.toString(),
      name: 'Thu lãi sổ tiết kiệm',
      description: `Thu lãi hàng tháng (tháng thứ ${stt}) cho sổ tiết kiệm: ${saving?.savingsAccountName}`,
      amount: monthlyInterest,
      transactionTime: moment(saving?.startDate).add(stt, 'months').toISOString(),
      detailInfo: {
        moneyFromType: MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT,
        moneyFromId: saving._id.toString(),
        moneyTargetType: MONEY_SOURCE_TYPE.ACCOUNT,
        moneyTargetId: interestPaidTarget._id.toString()
      }
    }
    // Tăng số dư cho sổ tiết kiệm để phục vụ cho chuyển khoản
    await savingsAccountModel.increaseBalance(savingId, monthlyInterest)
    const result = await transactionService.createIndividualTransaction(userId.toString(), transactionData, '')

    return result
  } catch (error) { throw error }
}

const rollOverPrincipal = async (userId, savingId) => { // Tái tục gốc
  const session = MongoClientInstance.startSession()

  let newSavingsAccount = null
  try {
    newSavingsAccount = await runTransactionWithRetry(async (session) => {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary'
      })

      const user = await userModel.findOneById(userId, { session })
      if (!user) throw new ApiError(StatusCodes.NOT_FOUND, `Người dùng ${userId.toString()} ko tồn tại!`)

      const oldSaving = await savingsAccountModel.findOneById(savingId, { session })
      if (!oldSaving) throw new ApiError(StatusCodes.NOT_FOUND, `Sổ tiết kiệm ${savingId.toString()} không tồn tại!`)
      else if (oldSaving?.ownerId?.toString() != userId.toString()) throw new ApiError(StatusCodes.FORBIDDEN, `Người dùng ${userId.toString()} ko có quyền truy cập sổ tiết kiệm ${savingId.toString()}!`)
      else if (oldSaving?.isClosed == true) throw new ApiError(StatusCodes.CONFLICT, `Sổ tiết kiệm ${savingId.toString()} đã tất toán!`)
      else if (oldSaving?.termEnded != TERM_ENDED.ROLL_OVER_PRINCIPAL) throw new ApiError(StatusCodes.BAD_REQUEST, `Sổ tiết kiệm ${savingId.toString()} không thuộc diện tái tục gốc!`)

      const maturityDate = moment(oldSaving.startDate).clone().add(oldSaving.term, 'months').toISOString()
      if (moment().isBefore(moment(maturityDate))) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, `Sổ tiết kiệm ${savingId.toString()} chưa đến kỳ hạn để tất toán!`)

      // Tạo sổ tiết kiệm mới
      const newSavingsAccountData = {
        savingsAccountName: generateNewName(oldSaving?.savingsAccountName),
        bankId: oldSaving?.bankId.toString(),
        initBalance: oldSaving?.initBalance,
        rate: oldSaving?.rate,
        nonTermRate: oldSaving?.nonTermRate,
        startDate: moment(oldSaving?.startDate).add(oldSaving?.term, 'months').toISOString(),
        term: oldSaving?.term,
        interestPaid: oldSaving?.interestPaid,
        termEnded: oldSaving?.termEnded,
        interestPaidTargetId: oldSaving?.interestPaidTargetId.toString(),
        interestPaidTargetType: oldSaving?.interestPaidTargetType,
        description: `Sổ tiết kiệm tái tục gốc từ sổ: ${oldSaving?.savingsAccountName}`,
        isRolledOver: true,
        parentSavingId: oldSaving?._id.toString(),
        moneyFromType: MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT,
        moneyFromId: oldSaving?._id.toString()
      }
      const createdSavingsAccount = await savingService.createIndividualSaving(userId.toString(), newSavingsAccountData, { session })

      // Tất toán sổ tiết kiệm
      const updateData = {
        balance: 0,
        isClosed: true
      }
      await savingsAccountModel.update(savingId, updateData, { session })

      // Gán data mới vào newSavingsAccount
      newSavingsAccount = await savingsAccountModel.findOneById(createdSavingsAccount._id, { session })

      await commitWithRetry(session)
      return newSavingsAccount
    }, MongoClientInstance, session)

    return newSavingsAccount
  } catch (error) {
    if (session.inTransaction()) { await session.abortTransaction().catch(() => {}) }
    throw error
  } finally {
    await session.endSession()
    //Tính toán, lên lịch các tác vụ tự động
    if (newSavingsAccount) {
      if (newSavingsAccount?.interestPaid == INTEREST_PAID.MONTHLY) {
        await agenda.now('monthly_saving_solver', {
          jobType: AGENDA_NOTIFICATION_TYPES.MONTHLY_SAVING_SOLVER,
          userId: new ObjectId(userId),
          savingId: newSavingsAccount?._id,
          stt: 0
        })
      } else if (newSavingsAccount?.interestPaid == INTEREST_PAID.MATURITY) {
        await agenda.now('maturity_saving_solver', {
          jobType: AGENDA_NOTIFICATION_TYPES.MATURITY_SAVING_SOLVER,
          userId: new ObjectId(userId),
          savingId: newSavingsAccount?._id
        })
      }
    }
  }
}

const receiveMaturityInterest = async (userId, savingId) => {
  try {
    const user = await userModel.findOneById(userId)
    if (!user) throw new ApiError(StatusCodes.NOT_FOUND, `Người dùng ${userId.toString()} ko tồn tại!`)

    const saving = await savingsAccountModel.findOneById(savingId)
    if (!saving) throw new ApiError(StatusCodes.NOT_FOUND, `Sổ tiết kiệm ${savingId.toString()} không tồn tại!`)
    else if (saving?.ownerId?.toString() != userId.toString()) throw new ApiError(StatusCodes.FORBIDDEN, `Người dùng ${userId.toString()} ko có quyền truy cập sổ tiết kiệm ${savingId.toString()}!`)
    else if (saving?.isClosed == true) throw new ApiError(StatusCodes.CONFLICT, `Sổ tiết kiệm ${savingId.toString()} đã tất toán!`)
    else if (saving?.interestPaid != INTEREST_PAID.MATURITY) throw new ApiError(StatusCodes.BAD_REQUEST, `Sổ tiết kiệm ${savingId.toString()} không thuộc diện nhận cuối kỳ!`)

    // const maturityDate = moment(saving.startDate).clone().add(saving.term, 'months').toISOString()
    // const lastValidDate = moment(maturityDate).add(5, 'days')
    // // Ngày thu lãi ko quá 5 ngày với ngày đáo hạn
    // if (moment().isAfter(lastValidDate)) throw new ApiError(StatusCodes.CONFLICT, `Sổ tiết kiệm ${savingId.toString()} quá hạn để thu lãi suất!`)

    const maturityInterest = Math.round((saving?.initBalance * saving?.rate * saving?.term) / 1200)
    // Kiểm tra tài khoản nhận lãi, nếu ko có thì mặc định trả về nguồn tiền gửi vào sổ tiết kiệm
    let interestPaidTarget
    interestPaidTarget = await accountModel.findOneById(saving?.interestPaidTargetId)
    if (!interestPaidTarget) {
      console.error(`Không tìm thấy interestPaidTarget có id ${saving?.interestPaidTargetId.toString()} khi thực hiện thu lãi hàng tháng cho sổ tiết kiệm có id ${savingId.toString()}`)
      // Lấy nguồn tiền gửi stk làm nơi nhận tiền mặc định
      interestPaidTarget = await accountModel.findOneById(saving?.moneyFromId)
      if (!interestPaidTarget) {
        console.error(`Không tìm thấy tài khoản gửi sổ tiết kiệm có id ${saving?.moneyFromId.toString()} làm nơi nhận lãi mặc định khi thực hiện thu lãi hàng tháng cho sổ tiết kiệm có id ${savingId.toString()}`)

        throw new ApiError(StatusCodes.NOT_FOUND, `Không tìm thấy nơi nhận lãi khi thực hiện thu lãi hàng tháng cho sổ tiết kiệm có id ${savingId.toString()}`)
      }
    }

    // Tạo giao dịch chuyển khoản từ sổ tiết kiệm về tài khoản nhận tiền
    const transferCategoryFilter = {
      ownerType: OWNER_TYPE.INDIVIDUAL,
      ownerId: new ObjectId(userId),
      _destroy: false,
      type: TRANSACTION_TYPES.TRANSFER
    }
    const transferCategory = await categoryModel.findOneCategory(transferCategoryFilter)
    const transactionData = {
      type: TRANSACTION_TYPES.TRANSFER,
      categoryId: transferCategory._id.toString(),
      name: 'Thu lãi sổ tiết kiệm',
      description: `Thu lãi cuối kỳ cho sổ tiết kiệm: ${saving?.savingsAccountName}`,
      amount: maturityInterest,
      transactionTime: moment(saving?.startDate).add(saving?.term, 'months').toISOString(),
      detailInfo: {
        moneyFromType: MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT,
        moneyFromId: saving._id.toString(),
        moneyTargetType: MONEY_SOURCE_TYPE.ACCOUNT,
        moneyTargetId: interestPaidTarget._id.toString()
      }
    }
    // Tăng số dư cho sổ tiết kiệm để phục vụ cho chuyển khoản
    await savingsAccountModel.increaseBalance(savingId, maturityInterest)
    const result = await transactionService.createIndividualTransaction(userId.toString(), transactionData, '')

    return result
  } catch (error) { throw error}
}

const rollOverPrincipalAndInterest = async (userId, savingId) => {
  const session = MongoClientInstance.startSession()

  let newSavingsAccount = null
  try {
    newSavingsAccount = await runTransactionWithRetry(async (session) => {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary'
      })

      const user = await userModel.findOneById(userId, { session })
      if (!user) throw new ApiError(StatusCodes.NOT_FOUND, `Người dùng ${userId.toString()} ko tồn tại!`)

      const oldSaving = await savingsAccountModel.findOneById(savingId, { session })
      if (!oldSaving) throw new ApiError(StatusCodes.NOT_FOUND, `Sổ tiết kiệm ${savingId.toString()} không tồn tại!`)
      else if (oldSaving?.ownerId?.toString() != userId.toString()) throw new ApiError(StatusCodes.FORBIDDEN, `Người dùng ${userId.toString()} ko có quyền truy cập sổ tiết kiệm ${savingId.toString()}!`)
      else if (oldSaving?.isClosed == true) throw new ApiError(StatusCodes.CONFLICT, `Sổ tiết kiệm ${savingId.toString()} đã tất toán!`)
      else if (oldSaving?.termEnded != TERM_ENDED.ROLL_OVER_PRINCIPAL_AND_INTEREST) throw new ApiError(StatusCodes.BAD_REQUEST, `Sổ tiết kiệm ${savingId.toString()} không thuộc diện tái tục gốc và lãi!`)

      const maturityDate = moment(oldSaving.startDate).clone().add(oldSaving.term, 'months').toISOString()
      if (moment().isBefore(moment(maturityDate))) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, `Sổ tiết kiệm ${savingId.toString()} chưa đến kỳ hạn để tất toán!`)

      // Tăng số dư cho sổ tiết kiệm để phục vụ cho chuyển khoản
      const maturityInterest = Math.round((oldSaving?.initBalance * oldSaving?.rate * oldSaving?.term) / 1200)
      await savingsAccountModel.increaseBalance(savingId, maturityInterest, { session })

      // Tạo sổ tiết kiệm mới
      const totalInterest = Math.round((oldSaving?.initBalance * oldSaving?.rate * oldSaving?.term) / 1200)
      const newSavingsAccountData = {
        savingsAccountName: generateNewName(oldSaving?.savingsAccountName),
        bankId: oldSaving?.bankId.toString(),
        initBalance: Number(oldSaving?.initBalance) + Number(totalInterest),
        rate: oldSaving?.rate,
        nonTermRate: oldSaving?.nonTermRate,
        startDate: moment(oldSaving?.startDate).add(oldSaving?.term, 'months').toISOString(),
        term: oldSaving?.term,
        interestPaid: oldSaving?.interestPaid,
        termEnded: oldSaving?.termEnded,
        interestPaidTargetId: oldSaving?.interestPaidTargetId?.toString(),
        interestPaidTargetType: oldSaving?.interestPaidTargetType,
        description: `Sổ tiết kiệm tái tục gốc và lãi từ sổ: ${oldSaving?.savingsAccountName}`,
        isRolledOver: true,
        parentSavingId: oldSaving?._id.toString(),
        moneyFromType: MONEY_SOURCE_TYPE.SAVINGS_ACCOUNT,
        moneyFromId: oldSaving._id.toString()
      }
      newSavingsAccount = await savingService.createIndividualSaving(userId.toString(), newSavingsAccountData, { session })

      // Tất toán sổ tiết kiệm cũ
      const updateData = {
        balance: 0,
        isClosed: true
      }
      await savingsAccountModel.update(savingId, updateData, { session })

      await commitWithRetry(session)
      return newSavingsAccount
    }, MongoClientInstance, session)

    return newSavingsAccount
  } catch (error) {
    if (session.inTransaction()) { await session.abortTransaction().catch(() => {}) }
    throw error
  } finally {
    await session.endSession()
    //Tính toán, lên lịch các tác vụ tự động
    if (newSavingsAccount) {
      if (newSavingsAccount?.interestPaid == INTEREST_PAID.MONTHLY) {
        await agenda.now('monthly_saving_solver', {
          jobType: AGENDA_NOTIFICATION_TYPES.MONTHLY_SAVING_SOLVER,
          userId: new ObjectId(userId),
          savingId: newSavingsAccount?._id,
          stt: 0
        })
      } else if (newSavingsAccount?.interestPaid == INTEREST_PAID.MATURITY) {
        await agenda.now('maturity_saving_solver', {
          jobType: AGENDA_NOTIFICATION_TYPES.MATURITY_SAVING_SOLVER,
          userId: new ObjectId(userId),
          savingId: newSavingsAccount?._id
        })
      }
    }
  }
}

export const savingService = {
  createIndividualSaving,
  createFamilySaving,
  getIndividualSavings,
  closeSaving,
  receiveMonthlyInterest,
  rollOverPrincipal,
  receiveMaturityInterest,
  rollOverPrincipalAndInterest
}