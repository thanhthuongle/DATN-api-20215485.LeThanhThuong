import { hostname } from 'node:os'

export const AGENDA_JOB_COLLECTION = 'v2_jobs'

const parseMongoIdentity = (uri, fallbackDatabaseName) => {
  const parsed = new URL(uri)
  const databaseName = parsed.pathname.replace(/^\//, '') || fallbackDatabaseName
  if (!parsed.pathname.replace(/^\//, '')) {
    parsed.pathname = `/${fallbackDatabaseName}`
  }

  return {
    address: parsed.toString(),
    host: parsed.host.toLowerCase(),
    username: decodeURIComponent(parsed.username || ''),
    databaseName
  }
}

export const assertAgendaStoreIsolation = ({
  agendaMongoUri,
  agendaDatabaseName,
  businessMongoUri,
  businessDatabaseName
}) => {
  if (!agendaMongoUri || !agendaDatabaseName) {
    throw new Error('Agenda V2 requires AGENDA_MONGODB_URI and AGENDA_DATABASE_NAME')
  }

  const agenda = parseMongoIdentity(agendaMongoUri, agendaDatabaseName)
  if (agenda.databaseName !== agendaDatabaseName) {
    throw new Error('AGENDA_MONGODB_URI database must match AGENDA_DATABASE_NAME')
  }

  if (businessDatabaseName && agendaDatabaseName === businessDatabaseName) {
    throw new Error('Agenda database must differ from the V1 business database')
  }

  if (businessMongoUri) {
    const business = parseMongoIdentity(businessMongoUri, businessDatabaseName)
    if (agenda.host === business.host && agenda.username && agenda.username === business.username) {
      throw new Error('Agenda and V1 business MongoDB must not share a credential identity')
    }
  }

  return Object.freeze({
    address: agenda.address,
    databaseName: agendaDatabaseName,
    collection: AGENDA_JOB_COLLECTION,
    workerId: `v2-worker:${hostname()}:${process.pid}`
  })
}
