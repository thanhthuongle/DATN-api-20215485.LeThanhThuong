import transferService from '~/v2/modules/transfer/services/transfer.service'

export const createTransfer = async (req, res, next) => {
  try {
    const result = await transferService.createTransfer({
      actor: { type: 'USER', id: req.userId || 'system' },
      spaceId: BigInt(req.body.spaceId),
      sourceAccountId: BigInt(req.body.sourceAccountId),
      targetAccountId: BigInt(req.body.targetAccountId),
      amount: BigInt(req.body.amount),
      fee: req.body.fee ? BigInt(req.body.fee) : BigInt(0),
      categoryId: req.body.categoryId ? BigInt(req.body.categoryId) : null,
      description: req.body.description
    })
    res.status(201).json({ data: result })
  } catch (error) {
    next(error)
  }
}
