import categoryService from '~/v2/modules/category/services/category.service'
import { toCategoryListResponse } from '../mappers/categoryMapper'

export const getCategoriesBySpace = async (req, res, next) => {
  try {
    const spaceId = BigInt(req.params.spaceId)
    const { type } = req.query
    const categories = type
      ? await categoryService.getBySpaceAndType(spaceId, type)
      : await categoryService.getBySpace(spaceId)
    res.json({ data: toCategoryListResponse(categories) })
  } catch (error) {
    next(error)
  }
}
