import notificationRepository from '../repositories/notification.repository'

/**
 * NotificationOutboxHandler — side-effect handler invoked by OutboxConsumer
 * AFTER the financial transaction commits (transaction-runtime.md §4).
 *
 * Event contract: aggregate_type 'notification', event_type 'NOTIFICATION_CREATED',
 * payload:
 *   {
 *     type: 'LINK'|'TEXT'|'INVITATION',
 *     title: string,
 *     message: string,
 *     link?: string|null,
 *     targetUserId?: bigint|string|null,
 *     financialSpaceId?: bigint|string|null
 *   }
 *
 * This handler never touches ledger/balance and never runs inside a financial
 * transaction; it is idempotent at the outbox layer via inbox_receipts.
 */
export class NotificationOutboxHandler {
  async handle(payload) {
    const type = payload.type === 'INVITATION' || payload.type === 'LINK' ? payload.type : 'TEXT'

    const created = await notificationRepository.create({
      type,
      title: payload.title,
      message: payload.message,
      link: payload.link || null,
      financial_space_id: payload.financialSpaceId ? BigInt(payload.financialSpaceId) : null,
      source_outbox_event_id: payload.sourceOutboxEventId ? BigInt(payload.sourceOutboxEventId) : null
    })

    let userNotification = null
    if (payload.targetUserId) {
      userNotification = await notificationRepository.createUserNotification({
        notification_id: created.id,
        user_id: BigInt(payload.targetUserId),
        is_read: false,
        received_at: new Date()
      })
    }

    return { notificationId: created.public_id, userNotificationId: userNotification?.public_id || null }
  }
}

const notificationOutboxHandler = new NotificationOutboxHandler()
export default notificationOutboxHandler

