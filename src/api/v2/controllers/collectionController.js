import collectionService from '~/v2/modules/collection/services/collection.service'

export const collect = async (req, res, next) => {
  try {
    const result = await collectionService.collect({
      actor: { type: 'USER', id: req.userId || 'system' },
      spaceId: BigInt(req.body.spaceId),
      targetAccountId: BigInt(req.body.targetAccountId),
      debtAgreementId: req.body.debtAgreementId
    })
    res.status(201).json({ data: result })
  } catch (error) {
    next(error)
  }
}
