require('dotenv').config()
const { provisionPostgresqlRoles } = require('./postgresql-role-policy.cjs')

const directConnectionString = process.env.POSTGRESQL_DIRECT_URL
const applicationConnectionString = process.env.POSTGRESQL_DATABASE_URL
if (!directConnectionString) throw new Error('POSTGRESQL_DIRECT_URL is required for role provisioning')
if (!applicationConnectionString) throw new Error('POSTGRESQL_DATABASE_URL is required for role provisioning')

provisionPostgresqlRoles({
  directConnectionString,
  applicationConnectionString
})
  .then(({ migrationRole, applicationRole }) => process.stdout.write(
    `PostgreSQL role provisioning PASS: migration=${migrationRole}, application=${applicationRole}, application least-privilege policy applied.\n`
  ))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
