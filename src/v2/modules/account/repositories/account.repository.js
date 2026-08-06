import TransactionContext from '~/v2/modules/financial/core/TransactionContext'
import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'

/**
 * AccountRepository — CRUD cho business accounts + linked ledger_accounts.
 * Financial writes đi qua TransactionContext.
 */
class AccountRepository {
  /**
   * Get accounts trong một financial space.
   */
  async findBySpace(spaceId) {
    const prisma = getPrismaClient()
    return prisma.accounts.findMany({
      where: { financial_space_id: spaceId, deleted_at: null },
      include: { ledger_accounts: true },
      orderBy: { created_at: 'desc' }
    })
  }

  /**
   * Get account by public_id.
   */
  async findByPublicId(publicId) {
    const prisma = getPrismaClient()
    return prisma.accounts.findFirst({
      where: { public_id: publicId, deleted_at: null },
      include: { ledger_accounts: true }
    })
  }

  /**
   * Create account + ledger_account trong transaction.
   * @param {TransactionContext} txContext
   * @param {object} data - { name, type, bankId, initialBalance, icon, description }
   */
  async createWithLedger(txContext, data) {
    TransactionContext.assertTransactionContext(txContext)

    // Create business account
    const account = await txContext.db.accounts.create({
      data: {
        financial_space_id: txContext.financialSpaceId,
        bank_id: data.bankId || null,
        type: data.type || 'WALLET',
        name: data.name,
        description: data.description || null,
        icon: data.icon || null,
        status: 'ACTIVE',
        legacy_initial_balance: data.initialBalance || BigInt(0),
        legacy_stored_balance: BigInt(0)
      }
    })

    // Create linked ledger account
    const ledgerAccount = await txContext.db.ledger_accounts.create({
      data: {
        financial_space_id: txContext.financialSpaceId,
        kind: 'USER_BALANCE',
        normal_side: 'DEBIT',
        account_id: account.id,
        name: data.name,
        current_balance: BigInt(0),
        current_sequence: BigInt(0),
        status: 'ACTIVE'
      }
    })

    return { account, ledgerAccount }
  }

  /**
   * Update account.
   */
  async update(txContext, id, data) {
    TransactionContext.assertTransactionContext(txContext)
    return txContext.db.accounts.update({ where: { id }, data })
  }

  /**
   * Soft-delete account.
   */
  async softDelete(txContext, id) {
    TransactionContext.assertTransactionContext(txContext)
    return txContext.db.accounts.update({
      where: { id },
      data: { deleted_at: new Date(), status: 'ARCHIVED' }
    })
  }
}

const accountRepository = new AccountRepository()
export default accountRepository
export { AccountRepository }
