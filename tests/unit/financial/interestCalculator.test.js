import { describe, expect, it } from 'vitest'
import interestCalculator from '~/v2/modules/saving/services/interestCalculator'

describe('InterestCalculator', () => {
  describe('roundToBigInt', () => {
    it('rounds HALF_UP at exact half', () => {
      expect(interestCalculator.roundToBigInt(1234.5)).toBe(1235n)
      expect(interestCalculator.roundToBigInt(1234.49)).toBe(1234n)
    })
  })

  describe('actualDays', () => {
    it('counts actual days inclusive', () => {
      // Jan 1 to Jan 2 = 2 days inclusive
      expect(interestCalculator.actualDays('2026-01-01', '2026-01-02')).toBe(2)
    })

    it('returns 0 for backward range', () => {
      expect(interestCalculator.actualDays('2026-01-05', '2026-01-01')).toBe(0)
    })
  })

  describe('interestByActualDays', () => {
    it('computes day-count interest', () => {
      // principal 10,000,000 * 6.5% * 30 days / 36500 = 53,424.65...
      const interest = interestCalculator.interestByActualDays({
        principal: BigInt(10000000),
        annualRatePercent: '6.5',
        startDate: '2026-01-01',
        endDate: '2026-01-30'
      })
      // 10000000 * 6.5 * 30 / 36500 = 53,424.657... => 53,425
      expect(interest).toBe(53425n)
    })
  })

  describe('interestByMonths', () => {
    it('computes term-month interest', () => {
      // principal 10,000,000 * 6.5% * 12 months / 1200 = 650,000
      const interest = interestCalculator.interestByMonths({
        principal: BigInt(10000000),
        annualRatePercent: '6.5',
        termMonths: 12
      })
      expect(interest).toBe(650000n)
    })
  })

  describe('computeInterest', () => {
    it('uses month formula when term >= 1', () => {
      const result = interestCalculator.computeInterest({
        principal: BigInt(10000000),
        annualRatePercent: '6.5',
        nonTermAnnualRatePercent: '6.5',
        termMonths: 6,
        startsAt: '2026-01-01'
      })
      expect(result.method).toBe('MONTHS')
      // 10000000 * 6.5 * 6 / 1200 = 325,000
      expect(result.interest).toBe(325000n)
    })

    it('uses day formula when no term', () => {
      const result = interestCalculator.computeInterest({
        principal: BigInt(10000000),
        annualRatePercent: '6.5',
        nonTermAnnualRatePercent: '6.5',
        termMonths: 0,
        startsAt: '2026-01-01',
        now: '2026-01-31'
      })
      expect(result.method).toBe('DAYS')
    })
  })
})
