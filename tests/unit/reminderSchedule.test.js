import { describe, expect, it, vi } from 'vitest'
import {
  localReminderTimeToUtc,
  rescheduleUserReminder
} from '~/v2/infrastructure/jobs/reminderSchedule'

describe('IANA reminder scheduling', () => {
  it('converts local reminder time to a UTC Agenda runAt', () => {
    expect(localReminderTimeToUtc('2026-08-01T08:00:00', 'Asia/Ho_Chi_Minh').toISOString())
      .toBe('2026-08-01T01:00:00.000Z')
    expect(localReminderTimeToUtc('2026-07-01T08:00:00', 'America/New_York').toISOString())
      .toBe('2026-07-01T12:00:00.000Z')
    expect(localReminderTimeToUtc('2026-01-01T08:00:00', 'America/New_York').toISOString())
      .toBe('2026-01-01T13:00:00.000Z')
  })

  it('reschedules a pending reminder with the same stable key', async () => {
    const scheduler = {
      cancel: vi.fn().mockResolvedValue(1),
      scheduleOnce: vi.fn().mockResolvedValue(undefined)
    }

    const runAt = await rescheduleUserReminder({
      scheduler,
      jobName: 'v2.infrastructure.smoke',
      localDateTime: '2026-08-01T08:00:00',
      timezone: 'Asia/Ho_Chi_Minh',
      payload: { probe: true },
      stableKey: 'reminder:user-1'
    })

    expect(scheduler.cancel).toHaveBeenCalledWith('reminder:user-1')
    expect(scheduler.scheduleOnce).toHaveBeenCalledWith(
      'v2.infrastructure.smoke',
      runAt,
      { probe: true },
      'reminder:user-1'
    )
  })

  it('rejects invalid timezone input', () => {
    expect(() => localReminderTimeToUtc('2026-08-01T08:00:00', 'Invalid/Timezone')).toThrow()
  })
})
