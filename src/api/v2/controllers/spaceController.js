import financialSpaceService from '~/v2/modules/financialSpace/services/financialSpace.service'
import { toSpaceListResponse, toSpaceResponse } from '../mappers/spaceMapper'

export const getSpacesByUser = async (req, res, next) => {
  try {
    const userId = BigInt(req.params.userId)
    const spaces = await financialSpaceService.getByUser(userId)
    res.json({ data: toSpaceListResponse(spaces) })
  } catch (error) {
    next(error)
  }
}

export const getSpaceByPublicId = async (req, res, next) => {
  try {
    const space = await financialSpaceService.getByPublicId(req.params.publicId)
    if (!space) return res.status(404).json({ message: 'Space not found' })
    res.json({ data: toSpaceResponse(space) })
  } catch (error) {
    next(error)
  }
}
