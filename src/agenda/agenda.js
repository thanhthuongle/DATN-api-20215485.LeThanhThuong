const Agenda = require('agenda')
import {env} from '~/config/environment'

export const agenda = new Agenda({
  db: {
    address: env.MONGODB_URI+env.DATABASE_NAME,
    collection: 'system_tasks'
  },
  processEvery: '30 seconds'
})
