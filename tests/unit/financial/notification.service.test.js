import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationService } from '~/v2/modules/notification/services/notification.service'
import notificationRepository from '~/v2/modules/notification/repositories/notification.repository'

describe('NotificationService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('markReaded', () => {
    it('throws 404 when notification not found', async () => {
      vi.spyOn(notificationRepository, 'findUserNotificationByPublicId').mockResolvedValueOnce(null)
      const service = new NotificationService()
      await expect(service.markReaded(BigInt(1), 'un-1')).rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 403 when user does not own the notification', async () => {
      vi.spyOn(notificationRepository, 'findUserNotificationByPublicId').mockResolvedValueOnce({
        user_id: BigInt(99),
        is_read: false
      })
      const service = new NotificationService()
      await expect(service.markReaded(BigInt(1), 'un-1')).rejects.toMatchObject({ statusCode: 403 })
    })

    it('throws 409 when already read', async () => {
      vi.spyOn(notificationRepository, 'findUserNotificationByPublicId').mockResolvedValueOnce({
        user_id: BigInt(1),
        is_read: true
      })
      const service = new NotificationService()
      await expect(service.markReaded(BigInt(1), 'un-1')).rejects.toMatchObject({ statusCode: 409 })
    })

    it('marks read and returns the updated notification', async () => {
      const updated = { user_id: BigInt(1), is_read: true }
      vi.spyOn(notificationRepository, 'findUserNotificationByPublicId')
        .mockResolvedValueOnce({ user_id: BigInt(1), is_read: false })
        .mockResolvedValueOnce(updated)
      const markSpy = vi.spyOn(notificationRepository, 'markReaded').mockResolvedValueOnce({ count: 1 })

      const service = new NotificationService()
      const result = await service.markReaded(BigInt(1), 'un-1')
      expect(markSpy).toHaveBeenCalledWith(BigInt(1), 'un-1')
      expect(result.is_read).toBe(true)
    })
  })

  describe('create', () => {
    it('creates a notification with message and link', async () => {
      const spy = vi.spyOn(notificationRepository, 'create').mockResolvedValueOnce({ id: BigInt(1) })
      const service = new NotificationService()
      await service.create({ type: 'TEXT', title: 'T', body: 'B', link: 'http://x' })
      expect(spy).toHaveBeenCalledWith({
        type: 'TEXT',
        title: 'T',
        message: 'B',
        link: 'http://x'
      })
    })
  })
})
