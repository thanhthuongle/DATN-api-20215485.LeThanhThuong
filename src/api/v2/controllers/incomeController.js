import incomeService from '~/v2/modules/income/services/income.service'

export const createIncome = async (req, res, next) => {
  try {
    const result = await incomeService.createIncome({
      actor: { type: 'USER', id: req.userId || 'system' },
      spaceId: BigInt(req.body.spaceId),
      targetAccountId: BigInt(req.body.targetAccountId),
      amount: BigInt(req.body.amount),
      categoryId: req.body.categoryId ? BigInt(req.body.categoryId) : null,
      description: req.body.description
    })
    res.status(201).json({ data: result })
  } catch (error) {
    next(error)
  }
}
