import { randomUUID } from 'node:crypto'

const SAFE_CORRELATION_ID = /^[A-Za-z0-9._:-]{8,128}$/

export const correlationIdMiddleware = (req, res, next) => {
  const suppliedId = req.get('x-correlation-id')
  const correlationId = suppliedId && SAFE_CORRELATION_ID.test(suppliedId)
    ? suppliedId
    : randomUUID()

  req.correlationId = correlationId
  res.set('X-Correlation-Id', correlationId)
  next()
}
