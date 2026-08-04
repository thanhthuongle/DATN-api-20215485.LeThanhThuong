export const toCategoryResponse = (cat) => ({
  publicId: cat.public_id,
  type: cat.transaction_type,
  name: cat.name,
  icon: cat.icon,
  createdAt: cat.created_at?.toISOString()
})

export const toCategoryListResponse = (cats) => cats.map(toCategoryResponse)
