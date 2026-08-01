const NAMESPACE_PATTERN = /^[a-z0-9][a-z0-9:-]*$/

export const assertV2RedisNamespace = (namespace) => {
  if (!namespace || !NAMESPACE_PATTERN.test(namespace) || !namespace.split(':').includes('v2')) {
    throw new Error('V2 Redis namespace must be explicit, lowercase and contain a v2 segment')
  }
  return namespace
}

export const createNamespacedRedis = ({ client, namespace }) => {
  const validatedNamespace = assertV2RedisNamespace(namespace)
  const key = (logicalKey) => {
    if (!logicalKey || typeof logicalKey !== 'string') throw new Error('Redis logical key is required')
    return `${validatedNamespace}:${logicalKey}`
  }

  return Object.freeze({
    key,
    get: (logicalKey) => client.get(key(logicalKey)),
    set: (logicalKey, value, options) => client.set(key(logicalKey), value, options),
    del: (logicalKey) => client.del(key(logicalKey))
  })
}
