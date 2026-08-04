import bankRepository from '../repositories/bank.repository'
import v2Cache from '~/v2/infrastructure/cache/v2Cache'
import { env } from '~/config/environment'

class BankService {
  async getBanks() {
    const cacheKey = 'v2:banks:all'
    const cacheTTL = parseInt(env.CACHE_TTL_BANKS || '3600')

    const cached = await v2Cache.get(cacheKey)
    if (cached) return cached

    const banks = await bankRepository.findAll()
    await v2Cache.set(cacheKey, banks, cacheTTL)
    return banks
  }

  async getBankByPublicId(publicId) {
    return bankRepository.findByPublicId(publicId)
  }
}

const bankService = new BankService()
export default bankService
export { BankService }
