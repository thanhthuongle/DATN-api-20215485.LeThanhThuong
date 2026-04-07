/* eslint-disable no-useless-catch */
import { ObjectId } from 'mongodb'
import { categoryModel } from '~/models/categoryModel'
import { OWNER_TYPE } from '~/utils/constants'
import { cacheService } from '~/utils/cache/cacheService'
import { CacheKeys } from '~/utils/cache/cacheKeys'
import { env } from '~/config/environment'

const getIndividualCategories = async (userId, query) => {
  try {
    const type = query.type
    let cacheKey

    if (type) {
      // If filtering by type, cache per-type
      const types = Array.isArray(type) ? type.sort().join(',') : type
      cacheKey = CacheKeys.INDIVIDUAL_CATEGORIES_TYPE(userId, types)
    } else {
      cacheKey = CacheKeys.INDIVIDUAL_CATEGORIES(userId)
    }

    const cacheTTL = parseInt(env.CACHE_TTL_CATEGORIES)

    const cached = await cacheService.get(cacheKey)
    if (cached) {
      console.info('Cache HIT:', cacheKey)
      return cached
    }

    console.info('Cache MISS:', cacheKey)

    const filter = {}
    filter.ownerType = OWNER_TYPE.INDIVIDUAL
    filter.ownerId = new ObjectId(userId)
    filter._destroy = false

    if (query.type) {
      if (Array.isArray(query.type)) { filter.type = { $in: query.type } }
      else { filter.type = query.type }
    }

    const categories = await categoryModel.getIndividualCategories(filter)

    await cacheService.set(cacheKey, categories, cacheTTL)

    return categories
  } catch (error) { throw error }
}

const getFamilyCategories = async (familyId, query) => {
  try {
    const { type } = query

    let cacheKey
    if (type) {
      const types = Array.isArray(type) ? type.sort().join(',') : type
      cacheKey = CacheKeys.FAMILY_CATEGORIES_TYPE(familyId, types)
    } else {
      cacheKey = CacheKeys.FAMILY_CATEGORIES(familyId)
    }

    const cacheTTL = parseInt(env.CACHE_TTL_CATEGORIES)

    const cached = await cacheService.get(cacheKey)
    if (cached) {
      console.info('Cache HIT:', cacheKey)
      return cached
    }

    console.info('Cache MISS:', cacheKey)

    const filter = {}
    filter.ownerType = OWNER_TYPE.FAMILY
    filter.ownerId = new ObjectId(familyId)
    filter._destroy = false

    if (query.type) {
      if (Array.isArray(query.type)) { filter.type = { $in: query.type } }
      else { filter.type = query.type }
    }

    const categories = await categoryModel.getFamilyCategories(filter)

    await cacheService.set(cacheKey, categories, cacheTTL)

    return categories
  } catch (error) { throw error }
}

/**
 * Create new category - invalidate user's category cache
 */
const createCategory = async (data, options = {}) => {
  const result = await categoryModel.createNew(data, options)

  // Invalidate category cache for this owner
  const ownerId = data.ownerId
  const ownerType = data.ownerType

  if (ownerType === 'individual') {
    await cacheService.invalidatePattern(CacheKeys.INDIVIDUAL_CATEGORIES(ownerId).replace(':all', '*'))
    await cacheService.invalidatePattern(CacheKeys.INDIVIDUAL_CATEGORIES_TYPE(ownerId, '*'))
  } else if (ownerType === 'family') {
    await cacheService.invalidatePattern(CacheKeys.FAMILY_CATEGORIES(ownerId).replace(':all', '*'))
    await cacheService.invalidatePattern(CacheKeys.FAMILY_CATEGORIES_TYPE(ownerId, '*'))
  }

  return result
}

/**
 * Update category - invalidate cache
 */
const updateCategory = async (categoryId, data, options = {}) => {
  const result = await categoryModel.update(categoryId, data, options)

  // Invalidation needed - cache is stale after update
  // Need to fetch the category to get ownerId/ownerType
  const category = await categoryModel.findOneById(categoryId)
  if (category) {
    const { ownerId, ownerType } = category
    if (ownerType === 'individual') {
      await cacheService.invalidatePattern(CacheKeys.INDIVIDUAL_CATEGORIES(ownerId).replace(':all', '*'))
    } else if (ownerType === 'family') {
      await cacheService.invalidatePattern(CacheKeys.FAMILY_CATEGORIES(ownerId).replace(':all', '*'))
    }
  }

  return result
}

/**
 * Soft delete category - invalidate cache
 */
const deleteCategory = async (categoryId, options = {}) => {
  // Get category before deletion to know the owner
  const category = await categoryModel.findOneById(categoryId)
  const result = await categoryModel.delete(categoryId, options)

  if (category) {
    const { ownerId, ownerType } = category
    if (ownerType === 'individual') {
      await cacheService.invalidatePattern(CacheKeys.INDIVIDUAL_CATEGORIES(ownerId).replace(':all', '*'))
    } else if (ownerType === 'family') {
      await cacheService.invalidatePattern(CacheKeys.FAMILY_CATEGORIES(ownerId).replace(':all', '*'))
    }
  }

  return result
}

export const categoryService = {
  getIndividualCategories,
  getFamilyCategories,
  createCategory,
  updateCategory,
  deleteCategory
}
