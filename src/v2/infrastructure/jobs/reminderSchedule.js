const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

const partsInTimezone = (instant, timezone) => Object.fromEntries(
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(instant)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, Number(part.value)])
)

export const localReminderTimeToUtc = (localDateTime, timezone) => {
  const match = LOCAL_DATE_TIME_PATTERN.exec(localDateTime)
  if (!match) throw new Error('Reminder localDateTime must be YYYY-MM-DDTHH:mm[:ss]')

  const [, year, month, day, hour, minute, second = '0'] = match
  const targetUtcShape = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second)
  let candidate = targetUtcShape

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = partsInTimezone(new Date(candidate), timezone)
    const observedUtcShape = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second
    )
    candidate -= observedUtcShape - targetUtcShape
  }

  const finalParts = partsInTimezone(new Date(candidate), timezone)
  if (
    finalParts.year !== +year || finalParts.month !== +month || finalParts.day !== +day ||
    finalParts.hour !== +hour || finalParts.minute !== +minute || finalParts.second !== +second
  ) {
    throw new Error('Reminder local time is invalid or ambiguous in the supplied IANA timezone')
  }

  return new Date(candidate)
}

export const rescheduleUserReminder = async ({
  scheduler,
  jobName,
  localDateTime,
  timezone,
  payload,
  stableKey
}) => {
  const runAt = localReminderTimeToUtc(localDateTime, timezone)
  await scheduler.cancel(stableKey)
  await scheduler.scheduleOnce(jobName, runAt, payload, stableKey)
  return runAt
}
