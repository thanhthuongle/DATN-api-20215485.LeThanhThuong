import { createClient } from 'redis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createNamespacedRedis } from '~/v2/infrastructure/cache/namespacedRedis'
import { startRedisContainer } from '../helpers/containers'

let redisContainer
let client

beforeAll(async () => {
  redisContainer = await startRedisContainer()
  client = createClient({ url: redisContainer.getConnectionUrl() })
  await client.connect()
})

afterAll(async () => {
  if (client?.isOpen) await client.quit()
  await redisContainer?.stop()
})

describe('Redis V1/V2 namespace isolation', () => {
  it('keeps identical logical keys separate', async () => {
    const v2 = createNamespacedRedis({ client, namespace: 'hey-money:v2:test' })
    const v1Key = 'hey-money:v1:test:account:123'

    await client.set(v1Key, 'v1-value')
    await v2.set('account:123', 'v2-value')

    await expect(client.get(v1Key)).resolves.toBe('v1-value')
    await expect(v2.get('account:123')).resolves.toBe('v2-value')
    expect(v1Key).not.toBe(v2.key('account:123'))
  })
})
