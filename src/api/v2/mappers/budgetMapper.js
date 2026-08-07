export const toBudgetAllocationResponse = (a) => ({
  publicId: a.public_id,
  categoryId: a.categories?.public_id || null,
  categoryName: a.category_name_snapshot,
  icon: a.icon_snapshot,
  amount: a.amount.toString(),
  repeat: a.repeat_enabled
})

export const toBudgetResponse = (budget) => ({
  publicId: budget.public_id,
  startsAt: budget.starts_at?.toISOString(),
  endsAt: budget.ends_at?.toISOString(),
  status: budget.status,
  allocations: (budget.budget_allocations || []).map(toBudgetAllocationResponse)
})

export const toBudgetListResponse = (budgets) => budgets.map(toBudgetResponse)
