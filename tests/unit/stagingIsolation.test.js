import { describe, expect, it } from 'vitest'
import { createStagingIsolationConfig } from '~/v2/infrastructure/config/stagingIsolation'
import { assertV2RedisNamespace } from '~/v2/infrastructure/cache/namespacedRedis'

const safeConfig = {
  deploymentEnv: 'staging',
  redisNamespace: 'hey-money:v2:staging',
  emailMode: 'sink',
  socketMode: 'disabled',
  notificationMode: 'capture'
}

describe('V2 staging side-effect isolation', () => {
  it('accepts only isolated/capture modes', () => {
    expect(createStagingIsolationConfig(safeConfig)).toEqual(safeConfig)
    expect(assertV2RedisNamespace('hey-money:v2:test')).toBe('hey-money:v2:test')
  })

  it.each([
    ['emailMode', 'live'],
    ['socketMode', 'production'],
    ['notificationMode', 'dispatch']
  ])('rejects unsafe %s', (field, value) => {
    expect(() => createStagingIsolationConfig({ ...safeConfig, [field]: value }))
      .toThrow(/Unsafe/)
  })

  it('rejects production environment and non-V2 Redis namespace', () => {
    expect(() => createStagingIsolationConfig({ ...safeConfig, deploymentEnv: 'production' }))
      .toThrow(/outside production/)
    expect(() => assertV2RedisNamespace('hey-money:production')).toThrow(/v2 segment/)
  })
})
