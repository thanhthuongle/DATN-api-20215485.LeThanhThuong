import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '~/generated/prisma/client'
import { env } from '~/config/environment'

const globalPrisma = globalThis
let prismaClient = globalPrisma.__v2PrismaClient || null

export const getPrismaClient = () => {
  if (!prismaClient) {
    const connectionString = env.POSTGRESQL_DATABASE_URL
    if (!connectionString) {
      throw new Error('POSTGRESQL_DATABASE_URL is required for the V2 PostgreSQL client')
    }

    const adapter = new PrismaPg({
      connectionString,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 10
    })

    prismaClient = new PrismaClient({
      adapter,
      log: process.env.DEPLOYMENT_ENV === 'development' ? ['warn', 'error'] : ['error']
    })

    if (process.env.NODE_ENV !== 'production') {
      globalPrisma.__v2PrismaClient = prismaClient
    }
  }

  return prismaClient
}

export const disconnectPrisma = async () => {
  if (!prismaClient) return

  await prismaClient.$disconnect()
  prismaClient = null
  delete globalPrisma.__v2PrismaClient
}
