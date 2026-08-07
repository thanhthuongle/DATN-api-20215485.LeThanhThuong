import budgetService from '~/v2/modules/budget/services/budget.service'
import { toBudgetListResponse, toBudgetResponse } from '../mappers/budgetMapper'

export const getBudgetsBySpace = async (req, res, next) => {
  try {
    const spaceId = BigInt(req.params.spaceId)
    const isFinish = req.query?.isFinish === 'true'
    const budgets = await budgetService.listBudgets({ spaceId, isFinish })
    res.json({ data: toBudgetListResponse(budgets) })
  } catch (error) {
    next(error)
  }
}

export const createBudgetAllocation = async (req, res, next) => {
  try {
    const spaceId = BigInt(req.params.spaceId)
    const result = await budgetService.createBudgetAllocation({
      spaceId,
      categoryId: BigInt(req.body.categoryId),
      categoryName: req.body.categoryName,
      icon: req.body.icon,
      amount: BigInt(req.body.amount),
      repeat: req.body.repeat,
      startsAt: new Date(req.body.startTime),
      endsAt: new Date(req.body.endTime)
    })
    res.status(201).json({ data: toBudgetResponse(result) })
  } catch (error) {
    next(error)
  }
}
