export const toNotificationResponse = (un) => ({
  publicId: un.public_id,
  isRead: un.is_read,
  receivedAt: un.received_at?.toISOString(),
  readAt: un.read_at?.toISOString() || null,
  notification: {
    publicId: un.notifications?.public_id,
    type: un.notifications?.type,
    title: un.notifications?.title,
    message: un.notifications?.message,
    link: un.notifications?.link || null
  }
})

export const toNotificationListResponse = (items) => items.map(toNotificationResponse)
