const Agenda = require('agenda')
import { env } from '~/config/environment'

const getMongoDbAddress = () => {
  let mongodbAddress = ''

  if (env.BUILD_MODE === 'dev') {
    mongodbAddress = env.MONGODB_URI.endsWith('/')
      ? env.MONGODB_URI + env.DATABASE_NAME
      : `${env.MONGODB_URI}/${env.DATABASE_NAME}`
  } else if (env.BUILD_MODE == 'production') {
    const [mainPart, query] = env.MONGODB_URI.split('?')

    const base = mainPart.endsWith('/')
      ? mainPart.slice(0, -1)
      : mainPart

    mongodbAddress = query
      ? `${base}/${env.DATABASE_NAME}?${query}`
      : `${base}/${env.DATABASE_NAME}`
  }

  return mongodbAddress
}

export const agenda = new Agenda({
  db: {
    address: getMongoDbAddress(),
    collection: 'system_tasks'
  },
  processEvery: '30 seconds'
})
