const REDACTED_KEY_PATTERN = /authorization|cookie|password|secret|token/i
const MAX_REDACTION_DEPTH = 20

const redactValue = (value, seen, depth) => {
  if (value === null || typeof value !== 'object') return value
  if (depth >= MAX_REDACTION_DEPTH) return '[MAX_DEPTH]'
  if (seen.has(value)) return '[CIRCULAR]'

  seen.add(value)
  try {
    if (Array.isArray(value)) {
      return value.map((item) => redactValue(item, seen, depth + 1))
    }

    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
      key,
      REDACTED_KEY_PATTERN.test(key)
        ? '[REDACTED]'
        : redactValue(child, seen, depth + 1)
    ]))
  } finally {
    seen.delete(value)
  }
}

const redact = (fields) => redactValue(fields, new WeakSet(), 0)

export const createStructuredLogger = ({ sink = console } = {}) => {
  const write = (level, event, fields = {}) => {
    if (!event) throw new Error('Structured log event name is required')

    const record = {
      timestamp: new Date().toISOString(),
      level,
      event,
      ...redact(fields)
    }
    const method = level === 'error' ? 'error' : 'info'
    sink[method](JSON.stringify(record))
    return record
  }

  return Object.freeze({
    info: (event, fields) => write('info', event, fields),
    error: (event, fields) => write('error', event, fields)
  })
}
