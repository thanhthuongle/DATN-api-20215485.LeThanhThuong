import transactionManager from '~/v2/modules/financial/core/TransactionManager'
import savingRepository from '../repositories/saving.repository'
import { v4 as uuidv4 } from 'uuid'

class SavingService {
  async createSaving({ actor, spaceId, sourceAccountId, bankId, name, depositAmount, interestRate, nonTermRate, termMonths, interestPaid, termEnded, startDate }) {
    const correlationId = uuidv4()
    const idempotencyKey = `saving-create-${uuidv4()}`

    return transactionManager.execute({
      actor: { actorType: actor.type || 'USER', actorId: actor.id },
      financialSpaceId: spaceId,
      correlationId,
      idempotencyKey,
      fn: async (txContext) => {
        const { saving } = await savingRepository.createWithLedger(txContext, {
          sourceAccountId,
          bankId,
          name,
          depositAmount: depositAmount || BigInt(0),
          interestRate: interestRate || 0,
          nonTermRate: nonTermRate || interestRate || 0,
          termMonths: termMonths || 0,
          interestPaid: interestPaid || 'MATURITY',
          termEnded: termEnded || 'CLOSE_ACCOUNT',
          startDate
        })

        return {
          publicId: saving.public_id,
          name: saving.name,
          depositAmount: saving.deposit_amount.toString(),
          interestRate: saving.interest_rate.toString(),
          status: saving.status
        }
      }
    })
  }

  async getSavingsBySpace(spaceId) {
    return savingRepository.findBySpace(spaceId)
  }

  async getSavingByPublicId(publicId) {
    return savingRepository.findByPublicId(publicId)
  }
}

const savingService = new SavingService()
export default savingService
export { SavingService }
