/* eslint-disable no-useless-catch */
import { ObjectId } from 'mongodb'
import { bankModel } from '~/models/bankModel'

const getBanks = async () => {
  try {
    const filter = {
      _destroy: false
    }

    const result = await bankModel.getBanks(filter)

    return result
  } catch (error) { throw error }
}

const getDetail = async (bankId) => {
  try {
    const filter = {
      _id: new ObjectId(bankId),
      _destroy: false
    }

    const result = await bankModel.getDetail(filter)

    return result
  } catch (error) { throw error }
}


export const bankService = {
  getBanks,
  getDetail
}
