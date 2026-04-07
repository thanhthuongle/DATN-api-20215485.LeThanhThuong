import { cacheService } from '~/utils/cache/cacheService'

export const cacheStatsMiddleware = (req, res, next) => {
  const start = Date.now()
  cacheService.resetStats()

  res.on('finish', () => {
    const duration = Date.now() - start
    const { hits, misses } = cacheService.getStats()

    let logMessage = `${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`
    if (hits > 0 || misses > 0) {
      logMessage += ` [Cache: +${hits}hits/-${misses}misses]`
    }

    console.info(logMessage)
  })

  next()
}
