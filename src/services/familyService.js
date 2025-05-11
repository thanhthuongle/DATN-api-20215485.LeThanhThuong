/* eslint-disable no-useless-catch */
import { MongoClientInstance } from '~/config/mongodb'
import { categoryModel } from '~/models/categoryModel'
import { familyModel } from '~/models/familyModel'
import { moneySourceModel } from '~/models/moneySourceModel'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'
import { cloneCategories } from '~/utils/cloneCategory'
import { OWNER_TYPE } from '~/utils/constants'
import { commitWithRetry, runTransactionWithRetry } from '~/utils/mongoTransaction'

const createNew = async (userId, reqBody, familyBackgroundImage) => {
  const session = MongoClientInstance.startSession()
  try {
    const newFamily = {
      ownerId: userId,
      familyName: reqBody.familyName
    }
    const result = await runTransactionWithRetry(async (session) => {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary'
      })

      const createdFamily = await familyModel.createNew(newFamily, { session })
      const getNewFamily = await familyModel.findOneById(createdFamily.insertedId, { session })

      if (getNewFamily) { // Tạo family mới thành công
        // init moneySource và category
        const dataCategory = cloneCategories(createdFamily.insertedId, OWNER_TYPE.FAMILY)
        await categoryModel.insertMany(dataCategory, { session })
        const newMoneySource = {
          ownerType: OWNER_TYPE.FAMILY,
          ownerId: createdFamily.insertedId.toString()
        }
        await moneySourceModel.createNew(newMoneySource, { session })

        // Nếu có ảnh thì upload và cập nhật
        if (familyBackgroundImage) {
          try {
            const uploadResult = await CloudinaryProvider.streamUpload(familyBackgroundImage.buffer, 'familyBackgrounds')

            await familyModel.update(createdFamily.insertedId, {
              backgroundImage: uploadResult.secure_url
            }, { session })
            getNewFamily.backgroundImage = uploadResult.secure_url
          } catch (error) {
            console.warn('Upload image failed:', error.message)
          }
        }
      }

      await commitWithRetry(session)

      return getNewFamily
    }, MongoClientInstance, session)

    //TODO: Tạo các lời mời vào nhóm

    return result
  } catch (error) {
    if (session.inTransaction()) { await session.abortTransaction().catch(() => {}) }
    throw error
  } finally {
    await session.endSession()
  }
}

export const familyService = {
  createNew
}
