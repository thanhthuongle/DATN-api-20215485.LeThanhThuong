import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const connectionString = process.env.POSTGRESQL_DATABASE_URL
if (!connectionString) {
  throw new Error('POSTGRESQL_DATABASE_URL is required for the Phase 2 infrastructure seed')
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

const run = async () => {
  await prisma.$queryRaw`SELECT 1 AS healthy`
  process.stdout.write('Phase 2 infrastructure seed PASS (no business data written).\n')
}

run()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
