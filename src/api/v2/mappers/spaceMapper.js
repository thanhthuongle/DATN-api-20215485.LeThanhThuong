export const toSpaceResponse = (s) => ({
  publicId: s.public_id || s.financial_spaces?.public_id,
  kind: s.kind || s.financial_spaces?.kind,
  status: s.status || s.financial_spaces?.status,
  name: s.financial_spaces?.name || null
})

export const toSpaceListResponse = (spaces) => spaces.map(toSpaceResponse)
