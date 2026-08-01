import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts'
  },
  datasource: {
    // Prisma CLI migrations use the direct PostgreSQL/Supabase connection.
    // Runtime uses POSTGRESQL_DATABASE_URL through the isolated pg driver adapter.
    url: env('POSTGRESQL_DIRECT_URL')
  }
})
