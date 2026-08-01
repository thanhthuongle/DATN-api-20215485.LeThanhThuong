import { describe, expect, it } from 'vitest'
import { assertAgendaStoreIsolation } from '~/v2/infrastructure/jobs/agendaStoreConfig'

const isolatedConfig = {
  agendaMongoUri: 'mongodb://agenda_worker:secret@agenda.example/agenda_v2',
  agendaDatabaseName: 'agenda_v2',
  businessMongoUri: 'mongodb://business_app:secret@business.example/hey_money',
  businessDatabaseName: 'hey_money'
}

describe('Agenda store configuration isolation', () => {
  it('accepts a dedicated store identity', () => {
    expect(assertAgendaStoreIsolation(isolatedConfig)).toMatchObject({
      databaseName: 'agenda_v2',
      collection: 'v2_jobs',
      workerId: expect.stringMatching(/^v2-worker:.+:\d+$/)
    })
  })

  it('injects AGENDA_DATABASE_NAME when the URI has no database path', () => {
    const result = assertAgendaStoreIsolation({
      ...isolatedConfig,
      agendaMongoUri: 'mongodb://agenda_worker:secret@agenda.example'
    })

    expect(new URL(result.address).pathname).toBe('/agenda_v2')
  })

  it('rejects shared database or credential identity', () => {
    expect(() => assertAgendaStoreIsolation({
      ...isolatedConfig,
      agendaDatabaseName: 'hey_money',
      agendaMongoUri: 'mongodb://agenda_worker:secret@agenda.example/hey_money'
    })).toThrow(/database must differ/)

    expect(() => assertAgendaStoreIsolation({
      ...isolatedConfig,
      agendaMongoUri: 'mongodb://business_app:secret@business.example/agenda_v2'
    })).toThrow(/credential identity/)
  })
})
