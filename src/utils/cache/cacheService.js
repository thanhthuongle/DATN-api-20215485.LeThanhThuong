import { getCacheClient, isCacheAvailable } from './cacheClient'
import { env } from '~/config/environment'

let requestHits = 0
let requestMisses = 0

export const cacheService = {
  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Deserialized value or null if miss
   */
  async get(key) {
    if (!isCacheAvailable()) return null

    try {
      const cached = await getCacheClient().get(key)
      if (cached) {
        requestHits++
        return JSON.parse(cached)
      } else {
        requestMisses++
        return null
      }
    } catch (error) {
      console.warn(`Cache get failed for key ${key}:`, error.message)
      return null // Fail silently - fallback to DB
    }
  },

  // Reset stats cho request mới (gọi từ middleware)
  resetStats() {
    requestHits = 0
    requestMisses = 0
  },

  // Lấy stats hiện tại
  getStats() {
    return { hits: requestHits, misses: requestMisses }
  },

  /**
   * Set value in cache with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache (will be JSON serialized)
   * @param {number} ttl - Time to live in seconds (optional, uses default from env)
   */
  async set(key, value, ttl) {
    if (!isCacheAvailable()) return

    try {
      const serialized = JSON.stringify(value)
      const ttlSeconds = ttl || parseInt(env.CACHE_DEFAULT_TTL)
      await getCacheClient().setEx(key, ttlSeconds, serialized)
    } catch (error) {
      console.warn(`Cache set failed for key ${key}:`, error.message)
    }
  },

  /**
   * Delete specific cache key
   */
  async del(...keys) {
    if (!isCacheAvailable()) return
    try {
      await getCacheClient().del(...keys)
    } catch (error) {
      console.warn('Cache delete failed:', error.message)
    }
  },

  /**
   * Invalidate cache by pattern (e.g., 'categories:individual:*')
   */
  async invalidatePattern(pattern) {
    if (!isCacheAvailable()) return
    try {
      const keys = await getCacheClient().keys(pattern)
      if (keys.length > 0) {
        await getCacheClient().del(keys)
      }
    } catch (error) {
      console.warn(`Cache invalidation failed for pattern ${pattern}:`, error.message)
    }
  },

  /**
   * Check if key exists (without retrieving)
   */
  async has(key) {
    if (!isCacheAvailable()) return false
    try {
      const exists = await getCacheClient().exists(key)
      return exists === 1
    } catch {
      return false
    }
  }
}
