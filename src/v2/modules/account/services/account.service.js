import transactionManager from '~/v2/modules/financial/core/TransactionManager'
import accountRepository from '../repositories/account.repository'
import { v4 as uuidv4 } from 'uuid'

/**
 * AccountService — business logic for accounts.
 * Tất cả financial write phải qua transactionManager.
 */
class AccountService {
  /**
   * Create account with optional opening balance transaction.
   */
  async createAccount({ actor, spaceId, name, type, bankId, initialBalance, icon, description }) {
    const correlationId = uuidv4()
    const idempotencyKey = `account-create-${uuidv4()}`

    return transactionManager.execute({
      actor: { actorType: actor.type || 'USER', actorId: actor.id },
      financialSpaceId: spaceId,
      correlationId,
      idempotencyKey,
      fn: async (txContext) => {
        const { account, ledgerAccount } = await accountRepository.createWithLedger(txContext, {
          name,
          type,
          bankId,
          initialBalance: initialBalance || BigInt(0),
          icon,
          description
        })

        return {
          account: {
            publicId: account.public_id,
            name: account.name,
            type: account.type,
            status: account.status
          },
          ledgerAccount: {
            publicId: ledgerAccount.public_id,
            balance: ledgerAccount.current_balance.toString()
          }
        }
      }
    })
  }

  async getAccountsBySpace(spaceId) {
    return accountRepository.findBySpace(spaceId)
  }

  async getAccountByPublicId(publicId) {
    return accountRepository.findByPublicId(publicId)
  }
}

const accountService = new AccountService()
export default accountService
export { AccountService }
