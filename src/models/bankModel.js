/* eslint-disable no-console */
import Joi from 'joi'
import { GET_DB } from '~/config/mongodb'

// Định nghĩa Collection (name & schema)
const BANK_COLLECTION_NAME = 'banks'
const BANK_COLLECTION_SCHEMA = Joi.object({
  code: Joi.string().required().min(3).max(60).trim().strict(),
  name: Joi.string().required().min(3).max(60).trim().strict(),
  logo: Joi.string().default(null),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra những Fields không cho phép cập nhật trong hàm update()
const INVALID_UPDATE_FIELDS = ['_id', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await BANK_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const seedBanksIfEmpty = async (data) => {
  const collection = GET_DB().collection(bankModel.BANK_COLLECTION_NAME)
  const count = await collection.countDocuments()
  if (count === 0) {
    try {
      console.log('🔄 Seeding ngân hàng mặc định...')
      const validData = await Promise.all(
        data.map(bank => validateBeforeCreate(bank))
      )
      const seedBanks = await GET_DB().collection(BANK_COLLECTION_NAME).insertMany(validData)
      console.log('✅ Seed thành công danh sách ngân hàng.')
      return seedBanks
    } catch (error) { throw new Error(error) }
  } else {
    console.log('✅ Danh sách ngân hàng đã tồn tại. Bỏ qua seed.')
  }
}

export const bankModel = {
  BANK_COLLECTION_NAME,
  BANK_COLLECTION_SCHEMA,
  seedBanksIfEmpty
}
