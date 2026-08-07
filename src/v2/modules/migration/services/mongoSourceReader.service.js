import { MongoClient } from 'mongodb'
import { env } from '~/config/environment'
import { DECLARED_SOURCE_COLLECTIONS } from '../constants'

/**
 * MongoSourceReaderService — read-only access to V1 MongoDB source data.
 *
 * The migration engine is the ONLY V2 module allowed to read V1 business
 * collections (source data bridge). It is strictly read-only:
 *   - The client is configured with readPreference and no write operations
 *     are ever issued.
 *   - A guard asserts the collection is one of the declared sources to avoid
 *     accidental access to unrelated collections.
 *
 * Decision: DEC-003 (no dual-write), final-migration-strategy.md "freeze
 * boundary" (only migration reader reads business collections).
 */

class MongoSourceReaderService {
  constructor() {
    /** @type {import('mongodb').MongoClient|null} */
    this.client = null
    this.database = null
    this._dbName = null
  }

  get isConnected() {
    return Boolean(this.client && this.database)
  }

  async connect() {
    if (this.isConnected) return this.database
    const uri = env.MONGODB_URI
    const dbName = env.DATABASE_NAME
    if (!uri) throw new Error('MONGODB_URI is required for migration source read')
    if (!dbName) throw new Error('DATABASE_NAME is required for migration source read')

    const client = new MongoClient(uri, {
      readPreference: 'secondaryPreferred',
      connectTimeoutMS: 15000
    })
    await client.connect()
    const db = client.db(dbName)

    this.client = client
    this.database = db
    this._dbName = dbName
    return db
  }

  async disconnect() {
    if (this.client) {
      await this.client.close()
      this.client = null
      this.database = null
      this._dbName = null
    }
  }

  _assertDb() {
    if (!this.database) throw new Error('Mongo source reader is not connected')
  }

  _assertCollection(name) {
    if (!DECLARED_SOURCE_COLLECTIONS.includes(name)) {
      throw new Error(`collection is not a declared migration source: ${name}`)
    }
  }

  async listCollections() {
    this._assertDb()
    const names = await this.database.listCollections(
      { name: { $in: DECLARED_SOURCE_COLLECTIONS } },
      { nameOnly: true }
    ).toArray()
    return names.map((item) => item.name)
  }

  async countDocuments(collectionName) {
    this._assertDb()
    this._assertCollection(collectionName)
    return this.database.collection(collectionName).countDocuments({})
  }

  /**
   * Fetch all documents of a collection, ordered by _id for determinism.
   * @param {string} collectionName
   * @returns {Promise<Array>} documents (mutable copies)
   */
  async findAll(collectionName) {
    this._assertDb()
    this._assertCollection(collectionName)
    return this.database.collection(collectionName)
      .find({})
      .sort({ _id: 1 })
      .toArray()
  }

  /**
   * Fetch a single document by 24-char legacy _id.
   * @param {string} collectionName
   * @param {string} legacyId
   */
  async findByLegacyId(collectionName, legacyId) {
    this._assertDb()
    this._assertCollection(collectionName)
    if (!/^[0-9a-f]{24}$/i.test(String(legacyId))) {
      throw new Error(`invalid legacy _id: ${legacyId}`)
    }
    return this.database
      .collection(collectionName)
      .findOne({ _id: legacyId })
  }

  /**
   * Fetch server build info for the manifest (read-only).
   */
  async serverInfo() {
    this._assertDb()
    const info = await this.client.db('admin').admin().serverInfo()
    return { serverVersion: info?.version ?? null, toolVersion: 'mongodb-driver' }
  }
}

const mongoSourceReaderService = new MongoSourceReaderService()
export default mongoSourceReaderService
export { MongoSourceReaderService }