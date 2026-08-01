const assert = require('node:assert/strict')

const {
  checkPostgresHealth
} = require('../build/src/v2/infrastructure/database/postgresHealth')
const {
  disconnectPrisma
} = require('../build/src/v2/infrastructure/database/prismaClient')

const run = async () => {
  try {
    const health = await checkPostgresHealth()
    assert.equal(health.status, 'ok')
    assert.equal(Number.isInteger(health.latencyMs), true)
    process.stdout.write(`PostgreSQL health PASS (${health.latencyMs}ms).\n`)
  } finally {
    await disconnectPrisma()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
