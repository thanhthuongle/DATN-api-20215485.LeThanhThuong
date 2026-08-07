const REQUIRED_FIELDS = [
  'ownerModule',
  'payloadVersion',
  'scheduleTimezone',
  'stableKeyPattern',
  'concurrency',
  'lockLifetimeMs',
  'retryPolicy',
  'timeoutMs',
  'sideEffects',
  'idempotencyScope',
  'runbook'
]

export const createJobRegistry = (entries) => {
  const registry = new Map()

  entries.forEach((entry) => {
    if (!entry.name) throw new Error('Job registry entry requires name')
    if (registry.has(entry.name)) throw new Error(`Duplicate job registry entry: ${entry.name}`)

    REQUIRED_FIELDS.forEach((field) => {
      if (entry[field] === undefined || entry[field] === null || entry[field] === '') {
        throw new Error(`Job registry entry ${entry.name} requires ${field}`)
      }
    })

    if (entry.scheduleTimezone !== 'UTC') {
      throw new Error(`Job registry entry ${entry.name} must schedule in UTC`)
    }

    registry.set(entry.name, Object.freeze({ ...entry }))
  })

  return Object.freeze({
    get: (jobName) => {
      const entry = registry.get(jobName)
      if (!entry) throw new Error(`Unregistered V2 job: ${jobName}`)
      return entry
    },
    list: () => Object.freeze([...registry.values()])
  })
}

export const infrastructureJobRegistry = createJobRegistry([{
  name: 'v2.infrastructure.smoke',
  ownerModule: 'platform',
  payloadVersion: 1,
  scheduleTimezone: 'UTC',
  stableKeyPattern: 'v2.infrastructure.smoke:<environment>',
  concurrency: 1,
  lockLifetimeMs: 30000,
  retryPolicy: 'none',
  timeoutMs: 10000,
  sideEffects: 'none',
  idempotencyScope: 'stable-key',
  runbook: 'docs/v2/operations/staging-foundation.md'
}])

export const businessJobRegistry = createJobRegistry([{
  name: 'v2.snapshot.daily',
  ownerModule: 'financial/snapshot',
  payloadVersion: 1,
  scheduleTimezone: 'UTC',
  stableKeyPattern: 'v2.snapshot.daily:<businessDate>',
  concurrency: 1,
  lockLifetimeMs: 30 * 60 * 1000,
  retryPolicy: 'retry-with-backoff',
  timeoutMs: 25 * 60 * 1000,
  sideEffects: 'none (writes via transaction core)',
  idempotencyScope: 'space+date (COMPLETED run guard)',
  runbook: 'docs/v2/architecture/periodic-balance-snapshots.md'
}])

export const defaultJobRegistry = createJobRegistry([
  ...businessJobRegistry.list(),
  ...infrastructureJobRegistry.list()
])
