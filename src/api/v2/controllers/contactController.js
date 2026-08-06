import contactService from '~/v2/modules/contact/services/contact.service'
import { toContactListResponse, toContactResponse } from '../mappers/contactMapper'

export const getContactsBySpace = async (req, res, next) => {
  try {
    const spaceId = BigInt(req.params.spaceId)
    const contacts = await contactService.getBySpace(spaceId)
    res.json({ data: toContactListResponse(contacts) })
  } catch (error) {
    next(error)
  }
}
