const SAFE_STAGING_MODES = Object.freeze({
  emailMode: new Set(['disabled', 'sink']),
  socketMode: new Set(['disabled', 'staging-only']),
  notificationMode: new Set(['disabled', 'capture'])
})

export const createStagingIsolationConfig = ({
  deploymentEnv,
  redisNamespace,
  emailMode,
  socketMode,
  notificationMode
}) => {
  if (deploymentEnv !== 'staging' && deploymentEnv !== 'test' && deploymentEnv !== 'development') {
    throw new Error('V2 foundation side-effect configuration is only valid outside production')
  }

  Object.entries({ emailMode, socketMode, notificationMode }).forEach(([name, value]) => {
    if (!SAFE_STAGING_MODES[name].has(value)) {
      throw new Error(`Unsafe V2 staging side-effect mode: ${name}=${value}`)
    }
  })

  if (!redisNamespace?.split(':').includes('v2')) {
    throw new Error('V2 staging Redis namespace must contain a v2 segment')
  }

  return Object.freeze({
    deploymentEnv,
    redisNamespace,
    emailMode,
    socketMode,
    notificationMode
  })
}
