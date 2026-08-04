import categoryRepository from '../repositories/category.repository'

class CategoryService {
  async getBySpace(spaceId) {
    return categoryRepository.findBySpace(spaceId)
  }

  async getBySpaceAndType(spaceId, type) {
    return categoryRepository.findBySpaceAndType(spaceId, type)
  }

  async createCategory({ spaceId, type, name, icon }) {
    return categoryRepository.create({
      financial_space_id: spaceId,
      transaction_type: type,
      name,
      icon: icon || null
    })
  }
}

const categoryService = new CategoryService()
export default categoryService
export { CategoryService }
