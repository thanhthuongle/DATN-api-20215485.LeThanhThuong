import expenseService from '~/v2/modules/expense/services/expense.service'

export const createExpense = async (req, res, next) => {
  try {
    const result = await expenseService.createExpense({
      actor: { type: 'USER', id: req.userId || 'system' },
      spaceId: BigInt(req.body.spaceId),
      sourceAccountId: BigInt(req.body.sourceAccountId),
      amount: BigInt(req.body.amount),
      categoryId: req.body.categoryId ? BigInt(req.body.categoryId) : null,
      description: req.body.description
    })
    res.status(201).json({ data: result })
  } catch (error) {
    next(error)
  }
}
