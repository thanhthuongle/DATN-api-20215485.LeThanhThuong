import { getPrismaClient } from './prismaClient'

export const checkPostgresHealth = async () => {
  const startedAt = Date.now()
  const prisma = getPrismaClient()
  await prisma.$queryRaw`SELECT 1 AS healthy`

  return {
    status: 'ok',
    latencyMs: Date.now() - startedAt
  }
}
