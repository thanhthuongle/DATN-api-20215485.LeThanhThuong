import { createClient } from 'redis'
import { env } from '~/config/environment'

let cacheClient = null

export const initializeCacheClient = async () => {
  if (!env.REDIS_URL) {
    console.warn('REDIS_URL not set, caching disabled')
    return null
  }

  try {
    cacheClient = createClient({
      url: env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500)
      }
    })

    cacheClient.on('error', (err) => {
      console.error('Redis Client Error:', err)
    })

    cacheClient.on('connect', () => {
      console.info('Redis client connected')
    })

    await cacheClient.connect()
    return cacheClient
  } catch (error) {
    console.error('Failed to connect to Redis:', error)
    return null
  }
}

export const getCacheClient = () => cacheClient

export const isCacheAvailable = () => {
  return env.CACHE_ENABLED && cacheClient?.isOpen
}
