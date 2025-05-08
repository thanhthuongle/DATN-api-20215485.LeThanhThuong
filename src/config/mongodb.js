import { MongoClient, ServerApiVersion } from 'mongodb'
import { env } from '~/config/environment'

// Khởi tạo một đối DatabaseInstance
let DatabaseInstance = null

// Khởi tạo một đối tượng MongoClientInstance để connect đến mongodb
export const MongoClientInstance = new MongoClient(env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
})

// Kết nối đến db
export const CONNECT_DB = async () => {
  await MongoClientInstance.connect()

  DatabaseInstance = MongoClientInstance.db(env.DATABASE_NAME)
}


export const GET_DB = () => {
  if (!DatabaseInstance) throw new Error('Phải kết nối tới DB trước!!!')
  return DatabaseInstance
}

// đóng kết nối db
export const CLOSE_DB = async () => {
  await MongoClientInstance.close()
}
