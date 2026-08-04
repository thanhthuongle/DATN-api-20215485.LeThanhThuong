import transactionManager from '~/v2/modules/financial/core/TransactionManager'
import financialTransactionService from '~/v2/modules/financial/core/financialTransaction.service'
import reversalService from '~/v2/modules/financial/core/reversal.service'
import { getPrismaClient } from '~/v2/infrastructure/database/prismaClient'
import { v4 as uuidv4 } from 'uuid'

/**
 * ContributionService — V2 personal-to-family contribution (composite).
 *
 * Posting template: CONTRIBUTION
 * - Source-space tx: source -A, INTERSPACE_CLEARING +A
 * - Target-space tx: INTERSPACE_CLEARING -A, target +A
 *
 * Design contract: financial-invariant-matrix.md §4 (CONTRIBUTION template)
 * Decision: DEC-070 (atomic group via two linked transactions), DEC-067
 */
class ContributionService {
  async contribute({ actor, sourceSpaceId, targetSpaceId, sourceAccountId, targetAccountId, amount, description, occurredAt }) {
    if (sourceSpaceId === targetSpaceId) {
      throw new Error('Contribution requires two distinct financial spaces')
    }

    const correlationId = uuidv4()
    const groupIdempotencyKey = `contribution-group-${uuidv4()}`
    const prisma = getPrismaClient()
    const actorObj = { actorType: actor.type || 'USER', actorId: actor.id }

    // Create interspace transfer group (DRAFT)
    const group = await prisma.interspace_transfer_groups.create({
      data: {
        source_financial_space_id: sourceSpaceId,
        target_financial_space_id: targetSpaceId,
        actor_user_id: BigInt(actor.id),
        source_ledger_account_id: BigInt(0),
        target_ledger_account_id: BigInt(0),
        amount,
        status: 'DRAFT',
        correlation_id: correlationId
      }
    })

    // 1. Post source-space transaction: source -A, source INTERSPACE_CLEARING +A
    const sourceTx = await transactionManager.execute({
      actor: actorObj,
      financialSpaceId: sourceSpaceId,
      correlationId,
      idempotencyKey: groupIdempotencyKey,
      fn: async (txContext) => {
        const sourceLedger = await txContext.db.ledger_accounts.findFirst({
          where: { account_id: sourceAccountId, status: 'ACTIVE' }
        })
        if (!sourceLedger) throw new Error(`Source ledger account not found: ${sourceAccountId}`)
        if (sourceLedger.current_balance < amount) {
          throw new Error(`Insufficient balance: have ${sourceLedger.current_balance}, need ${amount}`)
        }

        const clearingLedger = await txContext.db.ledger_accounts.findFirst({
          where: { system_role: 'INTERSPACE_CLEARING', financial_space_id: sourceSpaceId, status: 'ACTIVE' }
        })
        if (!clearingLedger) throw new Error(`INTERSPACE_CLEARING not found in source space ${sourceSpaceId}`)

        const template = await txContext.db.posting_template_definitions.findFirst({
          where: { code: 'CONTRIBUTION_OUT', status: 'APPROVED' }
        })
        if (!template) throw new Error('Posting template CONTRIBUTION_OUT not found')

        const result = await financialTransactionService.post(txContext, {
          type: 'CONTRIBUTION',
          postingTemplateDefinitionId: template.id,
          entries: [
            { ledgerAccountId: sourceLedger.id, amount: -amount, entryRole: 'SOURCE' },
            { ledgerAccountId: clearingLedger.id, amount: amount, entryRole: 'INTERSPACE_CLEARING' }
          ],
          businessSnapshot: {
            sourceAccountId: sourceLedger.id.toString(),
            groupId: group.id.toString(),
            description: description || null
          },
          options: {
            occurredAt: occurredAt?.toISOString() || new Date().toISOString(),
            metadata: { interspaceGroupId: group.id.toString() }
          }
        })

        return { transaction: result.transaction, sourceLedgerId: sourceLedger.id }
      }
    })

    try {
      // Record source transaction on group
      await prisma.interspace_transfer_groups.update({
        where: { id: group.id },
        data: { source_transaction_id: sourceTx.transaction.id, source_ledger_account_id: sourceTx.sourceLedgerId }
      })

      // 2. Post target-space transaction: target INTERSPACE_CLEARING -A, target +A
      const targetTx = await transactionManager.execute({
        actor: actorObj,
        financialSpaceId: targetSpaceId,
        correlationId,
        idempotencyKey: groupIdempotencyKey,
        fn: async (txContext) => {
          const targetLedger = await txContext.db.ledger_accounts.findFirst({
            where: { account_id: targetAccountId, status: 'ACTIVE' }
          })
          if (!targetLedger) throw new Error(`Target ledger account not found: ${targetAccountId}`)

          const clearingLedger = await txContext.db.ledger_accounts.findFirst({
            where: { system_role: 'INTERSPACE_CLEARING', financial_space_id: targetSpaceId, status: 'ACTIVE' }
          })
          if (!clearingLedger) throw new Error(`INTERSPACE_CLEARING not found in target space ${targetSpaceId}`)

          const template = await txContext.db.posting_template_definitions.findFirst({
            where: { code: 'CONTRIBUTION_IN', status: 'APPROVED' }
          })
          if (!template) throw new Error('Posting template CONTRIBUTION_IN not found')

          const result = await financialTransactionService.post(txContext, {
            type: 'CONTRIBUTION',
            postingTemplateDefinitionId: template.id,
            entries: [
              { ledgerAccountId: clearingLedger.id, amount: -amount, entryRole: 'INTERSPACE_CLEARING' },
              { ledgerAccountId: targetLedger.id, amount: amount, entryRole: 'TARGET' }
            ],
            businessSnapshot: {
              targetAccountId: targetLedger.id.toString(),
              groupId: group.id.toString(),
              description: description || null
            },
            options: {
              occurredAt: occurredAt?.toISOString() || new Date().toISOString(),
              metadata: { interspaceGroupId: group.id.toString() }
            }
          })

          return { transaction: result.transaction, targetLedgerId: targetLedger.id }
        }
      })

      // Both succeeded → mark group POSTED
      await prisma.interspace_transfer_groups.update({
        where: { id: group.id },
        data: { target_transaction_id: targetTx.transaction.id, target_ledger_account_id: targetTx.targetLedgerId, status: 'POSTED' }
      })

      return {
        groupId: group.public_id,
        sourceTransactionId: sourceTx.transaction.public_id,
        targetTransactionId: targetTx.transaction.public_id,
        amount: amount.toString(),
        status: 'POSTED'
      }
    } catch (error) {
      // Compensate: reverse source transaction, mark group REVERSED (DEC-070 atomic group)
      try {
        const reversalTemplate = await prisma.posting_template_definitions.findFirst({
          where: { code: 'CONTRIBUTION_OUT', status: 'APPROVED' }
        })
        await transactionManager.execute({
          actor: actorObj,
          financialSpaceId: sourceSpaceId,
          correlationId,
          idempotencyKey: `contribution-reversal-${uuidv4()}`,
          fn: async (txContext) => {
            await reversalService.reverse(txContext, {
              originalTransactionId: sourceTx.transaction.id,
              postingTemplateDefinitionId: reversalTemplate.id,
              businessSnapshot: { reason: 'contribution-group-partial-failure' }
            })
          }
        })
        await prisma.interspace_transfer_groups.update({
          where: { id: group.id },
          data: { status: 'REVERSED' }
        })
      } catch (reversalError) {
        console.error('Contribution compensation failed:', reversalError.message)
      }
      throw error
    }
  }
}

const contributionService = new ContributionService()
export default contributionService
export { ContributionService }
