/* eslint-disable no-useless-catch */
import { ObjectId } from 'mongodb'
import { bankModel } from '~/models/bankModel'
import { cacheService } from '~/utils/cache/cacheService'
import { CacheKeys } from '~/utils/cache/cacheKeys'

const getBanks = async () => {
  try {
    const filter = {
      _destroy: false
    }

    const cacheKey = CacheKeys.ALL_BANKS
    const cacheTTL = parseInt(process.env.CACHE_TTL_BANKS || 86400)

    // Try cache first
    const cached = await cacheService.get(cacheKey)
    if (cached) {
      console.info('Cache HIT:', cacheKey)
      return cached
    }

    console.info('Cache MISS:', cacheKey)

    const banks = await bankModel.getBanks(filter)

    await cacheService.set(cacheKey, banks, cacheTTL)

    return banks
  } catch (error) { throw error }
}

const getDetail = async (bankId) => {
  try {
    const filter = {
      _id: new ObjectId(bankId),
      _destroy: false
    }

    const cacheKey = CacheKeys.BANK_BY_ID(bankId?.toString())
    const cacheTTL = parseInt(process.env.CACHE_TTL_BANKS || 86400)

    const cached = await cacheService.get(cacheKey)
    if (cached) {
      console.info('Cache HIT:', cacheKey)
      return cached
    }

    console.info('Cache MISS:', cacheKey)

    const bank = await bankModel.getDetail(filter)
    if (!bank) return null

    await cacheService.set(cacheKey, bank, cacheTTL)

    return bank
  } catch (error) { throw error }
}


export const bankService = {
  getBanks,
  getDetail
}
