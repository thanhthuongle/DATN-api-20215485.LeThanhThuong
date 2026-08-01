const LOCAL_TEST_HOSTS = new Set(['127.0.0.1', 'localhost', 'host.docker.internal'])

export const assertDisposableDatabaseUrl = (databaseUrl) => {
  const parsed = new URL(databaseUrl)

  if (!LOCAL_TEST_HOSTS.has(parsed.hostname) || /supabase/i.test(databaseUrl)) {
    throw new Error(`Automated tests refuse non-disposable database host: ${parsed.hostname}`)
  }

  return databaseUrl
}
