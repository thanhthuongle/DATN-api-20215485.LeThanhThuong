import repaymentService from '~/v2/modules/repayment/services/repayment.service'

export const repay = async (req, res, next) => {
  try {
    const result = await repaymentService.repay({
      actor: { type: 'USER', id: req.userId || 'system' },
      spaceId: BigInt(req.body.spaceId),
      sourceAccountId: BigInt(req.body.sourceAccountId),
      debtAgreementId: req.body.debtAgreementId
    })
    res.status(201).json({ data: result })
  } catch (error) {
    next(error)
  }
}
