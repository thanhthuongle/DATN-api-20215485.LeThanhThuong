import contactRepository from '../repositories/contact.repository'

class ContactService {
  async getBySpace(spaceId) {
    return contactRepository.findBySpace(spaceId)
  }

  async createContact({ spaceId, name, trustLevel = 'NORMAL' }) {
    return contactRepository.create({
      financial_space_id: spaceId,
      name,
      trust_level: trustLevel
    })
  }

  async updateContact(publicId, data) {
    return contactRepository.update(publicId, data)
  }

  async deleteContact(publicId) {
    return contactRepository.softDelete(publicId)
  }
}

const contactService = new ContactService()
export default contactService
export { ContactService }
