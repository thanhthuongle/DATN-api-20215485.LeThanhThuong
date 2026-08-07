import financialQueryService from '~/v2/modules/financial/query/financialQuery.service'
import { toReportResponse, toBalanceSummaryResponse, toHistoryResponse } from '../mappers/queryMapper'

export const getSpaceBalanceSummary = async (req, res, next) => {
  try {
    const spaceId = BigInt(req.params.spaceId)
    const result = await financialQueryService.getSpaceBalanceSummary(spaceId)
    res.json({ data: toBalanceSummaryResponse(result) })
  } catch (error) {
    next(error)
  }
}

export const getTransactionHistory = async (req, res, next) => {
  try {
    const spaceId = BigInt(req.params.spaceId)
    const result = await financialQueryService.getTransactionHistory(spaceId, {
      from: req.query?.from,
      to: req.query?.to,
      limit: req.query?.limit,
      offset: req.query?.offset
    })
    res.json({ data: toHistoryResponse(result) })
  } catch (error) {
    next(error)
  }
}

export const getCategorySpendReport = async (req, res, next) => {
  try {
    const spaceId = BigInt(req.params.spaceId)
    const result = await financialQueryService.getCategorySpendReport(spaceId, {
      from: req.query?.from,
      to: req.query?.to
    })
    res.json({ data: toReportResponse(result) })
  } catch (error) {
    next(error)
  }
}
