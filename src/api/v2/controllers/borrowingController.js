import borrowingService from '~/v2/modules/borrowing/services/borrowing.service'

export const createBorrowing = async (req, res, next) => {
  try {
    const result = await borrowingService.createBorrowing({
      actor: { type: 'USER', id: req.userId || 'system' },
      spaceId: BigInt(req.body.spaceId),
      targetAccountId: BigInt(req.body.targetAccountId),
      contactId: BigInt(req.body.contactId),
      amount: BigInt(req.body.amount),
      rateBasis: req.body.rateBasis,
      rateValue: req.body.rateValue,
      dueAt: req.body.dueAt ? new Date(req.body.dueAt) : null,
      description: req.body.description
    })
    res.status(201).json({ data: result })
  } catch (error) {
    next(error)
  }
}
