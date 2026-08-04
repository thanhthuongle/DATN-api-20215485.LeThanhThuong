import familyRepository from '../repositories/family.repository'

class FamilyService {
  async getByOwner(userId) {
    return familyRepository.findByOwnerId(userId)
  }

  async getByPublicId(publicId) {
    return familyRepository.findByPublicId(publicId)
  }

  async getMembers(familyId) {
    return familyRepository.getMembers(familyId)
  }
}

const familyService = new FamilyService()
export default familyService
export { FamilyService }
