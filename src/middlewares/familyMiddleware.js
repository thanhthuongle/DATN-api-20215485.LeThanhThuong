import { familyModel } from '~/models/familyModel'
import { ObjectId } from 'mongodb'
import ApiError from '~/utils/ApiError'
import { StatusCodes } from 'http-status-codes'

const validateAndGetFamily = async (familyId) => {
  if (!ObjectId.isValid(familyId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'familyId không hợp lệ.')
  }

  const family = await familyModel.findOne({
    _id: new ObjectId(familyId),
    _destroy: false
  })

  if (!family) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Gia đình không tồn tại.')
  }

  return family
}

const isFamilyMember = async (req, res, next) => {
  try {
    const { familyId } = req.params
    const userId = req.jwtDecoded._id

    const family = await validateAndGetFamily(familyId)

    const isOwner = family.ownerIds?.some(id => id.equals(userId))
    const isMember = family.memberIds?.some(id => id.equals(userId))

    if (!isOwner && !isMember) {
      next(new ApiError(StatusCodes.FORBIDDEN, 'Bạn không thuộc gia đình này.'))
      return
    }

    req.family = family
    next()
  } catch (error) {
    next(error)
  }
}

const isFamilyOwner = async (req, res, next) => {
  try {
    const { familyId } = req.params
    const userId = req.jwtDecoded._id

    const family = await validateAndGetFamily(familyId)

    const isOwner = family.ownerIds?.some(id => id.equals(userId))

    if (!isOwner) {
      next(new ApiError(StatusCodes.FORBIDDEN, 'Bạn không có quyền quản trị gia đình này.'))
      return
    }

    req.family = family
    next()
  } catch (error) {
    next(error)
  }
}

export const familyMiddleware = {
  isFamilyMember,
  isFamilyOwner
}
