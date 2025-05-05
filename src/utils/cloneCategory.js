import { ObjectId } from 'mongodb'
import { categoriesDefault } from '../data/categoriesDefault.js'
import { TRANSACTION_TYPES } from './constants.js'

export const cloneCategories = async (ownerId, ownerType) => {
  const tempIdToRealId = {}
  const categoriesReady = []

  for (const [typeKey, defaultCategories] of Object.entries(categoriesDefault)) {
    const type = TRANSACTION_TYPES[typeKey.toUpperCase()] || typeKey

    for (const c of defaultCategories) {
      const _id = new ObjectId()
      tempIdToRealId[c.tempId + typeKey] = _id.toString()
      categoriesReady.push({
        _id,
        ownerId: new ObjectId(String(ownerId)),
        ownerType,
        name: c.categoryName,
        type,
        icon: c.icon ?? null,
        childrenIds: (c.childrenIds || []).map(cid => cid + typeKey),
        parentIds: c.parentId ? [c.parentId + typeKey] : [],
        createdAt: Date.now(),
        updatedAt: null,
        _destroy: false,
        tempId: c.tempId + typeKey
      })
    }
  }

  for (const category of categoriesReady) {
    category.childrenIds = category.childrenIds.map(tempId => new ObjectId(String(tempIdToRealId[tempId])))
    category.parentIds = category.parentIds.map(tempId => new ObjectId(String(tempIdToRealId[tempId])))
  }

  const finalCategories = categoriesReady.map(c => {
    const { tempId, ...rest } = c
    return rest
  })
  return finalCategories
}
