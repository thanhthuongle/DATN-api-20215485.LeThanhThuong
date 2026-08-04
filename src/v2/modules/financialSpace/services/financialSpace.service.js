import financialSpaceRepository from '../repositories/financialSpace.repository'

class FinancialSpaceService {
  async getByUser(userId) {
    return financialSpaceRepository.findByUserId(userId)
  }

  async getByPublicId(publicId) {
    return financialSpaceRepository.findByPublicId(publicId)
  }

  async createPersonalSpace(userId) {
    return financialSpaceRepository.create({
      kind: 'PERSONAL',
      owner_id: userId,
      status: 'ACTIVE'
    })
  }
}

const financialSpaceService = new FinancialSpaceService()
export default financialSpaceService
export { FinancialSpaceService }
