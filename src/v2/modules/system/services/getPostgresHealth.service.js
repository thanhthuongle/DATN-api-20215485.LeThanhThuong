import { checkPostgresHealth } from '~/v2/infrastructure/database/postgresHealth'

export const getPostgresHealthStatus = () => checkPostgresHealth()
