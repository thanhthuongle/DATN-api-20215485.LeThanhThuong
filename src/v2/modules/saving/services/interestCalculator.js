import { Decimal } from '@prisma/client/runtime/client'

/**
 * InterestCalculator — pure interest calculation for savings.
 *
 * Design contract: interest-rate-rules.md §2, §4
 * Decision: DEC-021
 *
 * - annual rate stored as DECIMAL(7,4) percent
 * - day-count: interest = principal * annualRatePercent * actualDays / 36500
 * - term-month: interest = principal * annualRatePercent * termMonths / 1200
 * - round once at the end using HALF_UP to whole VND (BIGINT)
 */
class InterestCalculator {
  /**
   * Round a value to a whole BIGINT using HALF_UP.
   * @param {Decimal|number|string} value
   * @returns {bigint}
   */
  roundToBigInt(value) {
    const d = new Decimal(value.toString())
    return BigInt(d.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString())
  }

  /**
   * Actual day count between two UTC dates (ACTUAL/365).
   * Includes both boundaries per V1 compatibility (off-by-one inclusive).
   * @param {Date|string} startDate
   * @param {Date|string} endDate
   * @returns {number} actual days (>=0)
   */
  actualDays(startDate, endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const ms = end.getTime() - start.getTime()
    if (ms < 0) return 0
    return Math.round(ms / (24 * 60 * 60 * 1000)) + 1
  }

  /**
   * Compute interest using actual-day-count (inclusive).
   */
  interestByActualDays({ principal, annualRatePercent, startDate, endDate }) {
    const p = new Decimal(principal.toString())
    const rate = new Decimal(annualRatePercent.toString())
    const days = new Decimal(this.actualDays(startDate, endDate))
    const interest = p.mul(rate).mul(days).div(36500)
    return this.roundToBigInt(interest)
  }

  /**
   * Compute interest using term-in-months (V1-compatible formula).
   */
  interestByMonths({ principal, annualRatePercent, termMonths }) {
    const p = new Decimal(principal.toString())
    const rate = new Decimal(annualRatePercent.toString())
    const months = new Decimal(termMonths.toString())
    const interest = p.mul(rate).mul(months).div(1200)
    return this.roundToBigInt(interest)
  }

  /**
   * Resolve which formula to use based on term availability.
   */
  computeInterest({ principal, annualRatePercent, nonTermAnnualRatePercent, termMonths, startsAt, now }) {
    if (termMonths && termMonths >= 1) {
      const interest = this.interestByMonths({ principal, annualRatePercent, termMonths })
      return { interest, method: 'MONTHS' }
    }
    const end = now || new Date()
    const interest = this.interestByActualDays({
      principal,
      annualRatePercent: nonTermAnnualRatePercent || annualRatePercent,
      startDate: startsAt,
      endDate: end
    })
    return { interest, method: 'DAYS' }
  }
}

const interestCalculator = new InterestCalculator()
export default interestCalculator
export { InterestCalculator }

