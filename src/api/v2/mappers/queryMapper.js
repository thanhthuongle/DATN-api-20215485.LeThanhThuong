export const toBalanceSummaryResponse = (s) => ({
  totalAccounts: s.totalAccounts,
  totalBalance: s.totalBalance,
  byKind: s.byKind
})

export const toHistoryResponse = (h) => ({
  total: h.total,
  items: h.rows.map((t) => ({
    publicId: t.public_id,
    type: t.type,
    status: t.status,
    name: t.name,
    amount: t.amount.toString(),
    occurredAt: t.occurred_at?.toISOString(),
    categoryId: t.categories?.public_id || null,
    categoryName: t.categories?.name || null
  }))
})

export const toReportResponse = (r) => ({
  totalOutflow: r.totalOutflow,
  totalInflow: r.totalInflow,
  categories: r.categories
})
