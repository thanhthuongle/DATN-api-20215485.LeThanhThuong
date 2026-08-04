import contributionService from '~/v2/modules/contribution/services/contribution.service'

export const contribute = async (req, res, next) => {
  try {
    const result = await contributionService.contribute({
      actor: { type: 'USER', id: req.userId || 'system' },
      sourceSpaceId: BigInt(req.body.sourceSpaceId),
      targetSpaceId: BigInt(req.body.targetSpaceId),
      sourceAccountId: BigInt(req.body.sourceAccountId),
      targetAccountId: BigInt(req.body.targetAccountId),
      amount: BigInt(req.body.amount),
      description: req.body.description
    })
    res.status(201).json({ data: result })
  } catch (error) {
    next(error)
  }
}
