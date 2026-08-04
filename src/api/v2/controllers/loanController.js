import loanService from '~/v2/modules/loan/services/loan.service'

export const createLoan = async (req, res, next) => {
  try {
    const result = await loanService.createLoan({
      actor: { type: 'USER', id: req.userId || 'system' },
      spaceId: BigInt(req.body.spaceId),
      sourceAccountId: BigInt(req.body.sourceAccountId),
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
