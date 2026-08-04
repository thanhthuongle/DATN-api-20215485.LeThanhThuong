import { cacheService } from '~/utils/cache/cacheService'

/**
 * V2 Cache Adapter — wraps V1 cache for V2 modules.
 * Trong tương lai sẽ có V2-native cache implementation.
 */
class V2Cache {
  async get(key) {
    return cacheService.get(key)
  }

  async set(key, value, ttl) {
    return cacheService.set(key, value, ttl)
  }

  async del(key) {
    return cacheService.del(key)
  }
}

const v2Cache = new V2Cache()
export default v2Cache
export { V2Cache }
