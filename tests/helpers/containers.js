import { MongoDBContainer } from '@testcontainers/mongodb'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { RedisContainer } from '@testcontainers/redis'
import { GenericContainer } from 'testcontainers'

export const startPostgresContainer = () => new PostgreSqlContainer('postgres:16-alpine')
  .withDatabase('hey_money_v2_test')
  .withUsername('hey_money_v2_test')
  .withPassword('hey_money_v2_test')
  .start()

export const startMongoContainer = () => new MongoDBContainer('mongo:7')
  .withUsername('testcontainers_root')
  .withPassword('testcontainers_root')
  .start()

export const startRedisContainer = () => new RedisContainer('redis:7').start()

export const startStandaloneMongoContainer = () => new GenericContainer('mongo:7')
  .withExposedPorts(27017)
  .start()
