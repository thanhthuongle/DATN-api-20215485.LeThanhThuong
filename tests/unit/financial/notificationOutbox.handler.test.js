import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationOutboxHandler } from '~/v2/modules/notification/services/notificationOutbox.handler'
import notificationRepository from '~/v2/modules/notification/repositories/notification.repository'

describe('NotificationOutboxHandler', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a notification and user-notification from payload', async () => {
    vi.spyOn(notificationRepository, 'create').mockResolvedValueOnce({
      id: BigInt(1),
      public_id: 'notif-1'
    })
    const createUserSpy = vi.spyOn(notificationRepository, 'createUserNotification')
      .mockResolvedValueOnce({ public_id: 'un-1' })

    const handler = new NotificationOutboxHandler()
    const result = await handler.handle({
      type: 'LINK',
      title: 'Title',
      message: 'Message',
      link: 'http://example.com',
      targetUserId: '42'
    })

    expect(notificationRepository.create).toHaveBeenCalledWith({
      type: 'LINK',
      title: 'Title',
      message: 'Message',
      link: 'http://example.com',
      financial_space_id: null,
      source_outbox_event_id: null
    })
    expect(createUserSpy).toHaveBeenCalledWith(expect.objectContaining({
      user_id: BigInt(42),
      notification_id: BigInt(1),
      is_read: false
    }))
    expect(result.notificationId).toBe('notif-1')
    expect(result.userNotificationId).toBe('un-1')
  })

  it('defaults unknown types to TEXT and skips user notification when no target', async () => {
    vi.spyOn(notificationRepository, 'create').mockResolvedValueOnce({
      id: BigInt(1),
      public_id: 'notif-1'
    })
    const createUserSpy = vi.spyOn(notificationRepository, 'createUserNotification')

    const handler = new NotificationOutboxHandler()
    const result = await handler.handle({
      title: 'Title',
      message: 'Message'
    })

    expect(notificationRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'TEXT'
    }))
    expect(createUserSpy).not.toHaveBeenCalled()
    expect(result.userNotificationId).toBeNull()
  })
})
