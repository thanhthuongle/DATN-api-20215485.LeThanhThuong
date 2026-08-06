export const toContactResponse = (c) => ({
  publicId: c.public_id,
  name: c.name,
  trustLevel: c.trust_level,
  createdAt: c.created_at?.toISOString()
})

export const toContactListResponse = (contacts) => contacts.map(toContactResponse)
