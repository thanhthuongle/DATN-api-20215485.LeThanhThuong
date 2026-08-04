import transactionManager from '~/v2/modules/financial/core/TransactionManager'
import accumulationRepository from '../repositories/accumulation.repository'
import { v4 as uuidv4 } from 'uuid'

class AccumulationService {
  async createAccumulation({ actor, spaceId, name, targetAmount, startsAt, endsAt, description }) {
    const correlationId = uuidv4()
    const idempotencyKey = `accumulation-create-${uuidv4()}`

    return transactionManager.execute({
      actor: { actorType: actor.type || 'USER', actorId: actor.id },
      financialSpaceId: spaceId,
      correlationId,
      idempotencyKey,
      fn: async (txContext) => {
        const { accumulation, ledgerAccount } = await accumulationRepository.createWithLedger(txContext, {
          name,
          targetAmount: targetAmount || BigInt(0),
          startsAt,
          endsAt,
          description
        })

        return {
          publicId: accumulation.public_id,
          name: accumulation.name,
          targetAmount: accumulation.target_amount.toString(),
          status: accumulation.status
        }
      }
    })
  }

  async getAccumulationsBySpace(spaceId) {
    return accumulationRepository.findBySpace(spaceId)
  }
}

const accumulationService = new AccumulationService()
export default accumulationService
export { AccumulationService }
