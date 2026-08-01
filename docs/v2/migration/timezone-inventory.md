# V1 UTC and Timezone Compensation Inventory

Ngày inventory: 2026-08-01. Target rule is already accepted: financial timestamps/business dates use UTC; IANA timezone is only for local reminders (DEC-032/049).

## 1. Coverage and classification

Static scan found **6 active hard-coded `.add(7, 'hours')` compensations**, 4 `moment.utc(...)` calls and one server-local midnight calculation. V1 user schema has no IANA timezone field.

Time is classified into:

- `FINANCIAL`: transaction occurrence, saving interest/day count, maturity/rollover, balance-affecting scheduled periods;
- `BUSINESS_WINDOW`: budgets/report filters;
- `REMINDER`: user notes, debt/accumulation notifications;
- `AUDIT/TECHNICAL`: created/updated/read timestamps, cache duration.

## 2. Hard-coded UTC+7 register

| ID/evidence | Purpose | Class | Risk | Migration rule owner/status |
|---|---|---|---|---|
| TZ-001 `monthlySavingSolver.js:70` | catch-up/next monthly saving solver time from UTC start + months +7h | FINANCIAL JOB | changes financial execution period by fixed Vietnam offset | Savings/jobs: use UTC period key/runAt; no raw offset / OPEN |
| TZ-002 `monthlySavingSolver.js:102` | schedule next monthly solver using local `moment` +7h | FINANCIAL JOB | inconsistent with TZ-001 because base parse is not explicit UTC | Savings/jobs / OPEN |
| TZ-003 `maturitySavingSolver.js:84` | schedule maturity solver at start + term +7h | FINANCIAL JOB | hard-coded zone affects maturity timing | Savings/jobs / OPEN |
| TZ-004 `accumulationService.js:55` | notify 7 hours after UTC endDate | REMINDER | encodes Asia/Ho_Chi_Minh without zone/intent; scheduled inside DB transaction | Accumulations/notifications / OPEN |
| TZ-005 `savingService.js:412` | monthly-interest transactionTime | **FINANCIAL OCCURRED_AT** | writes compensated timestamp into history rather than canonical UTC period boundary | Savings/migration / BLOCKING semantic rule |
| TZ-006 `savingService.js:558` | maturity-interest transactionTime | **FINANCIAL OCCURRED_AT** | same; legacy history day can differ | Savings/migration / BLOCKING semantic rule |

Production counts: saving records 0, accumulation records 2, transactions 124 and Agenda records 4. Agenda payloads reference savingId 0 and accumulationId 1; therefore TZ-001..003 and TZ-005..006 have 0 currently affected saving/job records, while TZ-004 has 2 possible accumulation records and 1 pending reminder payload. Source risks remain even when the current count is zero.

## 3. Financial time inventory

| Field/operation | V1 source behavior | Data representation/risk | V2/migration rule |
|---|---|---|---|
| `transactions.transactionTime` | required client ISO date; converted with `new Date`; future check uses local `moment()` only for individual endpoint | occurrence time is client-controlled; generic/family paths omit future check | persist `occurred_at` UTC; validate actor/time policy; `posted_at` DB-generated immutable UTC |
| saving `startDate` | Joi ISO then `moment(startDate).startOf('day').toISOString()` | `startOf('day')` uses process local timezone; stored value is ISO string after conversion | profile values; normalize only with documented legacy rule; V2 financial business date UTC |
| saving day interest | `moment()`/`moment(startDate)`, inclusive `diff days +1` | result depends on process timezone near day boundary | DEC-032 inclusive UTC day count; fixture/replay edge cases |
| saving monthly interest | `initBalance*rate/1200`, period date start+n months+7h | hard-coded execution/occurred time | stable UTC period key; explicit occurrence/posting distinction |
| saving maturity | local `moment()` comparisons; start + term months; some schedules explicit UTC+7 | mixed parsing bases | UTC comparisons and month formula retained per DEC-032; no user timezone |
| saving close | `transactionTime: new Date()` and current local `moment()` for early/term interest | instant is absolute but day-count boundary is process-zone dependent | UTC clock/business date; record migration provenance |
| debt `collectTime/repaymentTime` | client ISO stored through Joi and passed raw to Agenda | timezone offset may be present/absent in input; no explicit normalization rule | classify as reminder target; require offset/UTC instant or IANA local intent |
| `realCollectTime/realRepaymentTime` | client ISO detail field | business occurrence time, but header amount/time can differ | map to UTC occurred metadata with source provenance |
| accumulation start/end | client ISO; end reminder `moment.utc +7h` | financial goal period vs reminder intent mixed | period timestamps UTC; reminder may use user IANA zone only |

Periodic snapshot must use V2 database `posted_at` and UTC day `[00:00Z, 00:00Z next day)`, never these user/reminder offsets.

## 4. Reminder and notification time

| Behavior | Evidence | Risk/rule |
|---|---|---|
| Daily note setting | user `remindTime` is a single ISO timestamp; default built with local `moment().hour(12)` then ISO | stores an instant, not recurring local time/IANA zone; default varies with server TZ |
| Cron conversion | `moment.utc(remindTime)` -> minute/hour -> Agenda every `{timezone:'UTC'}` | preserves UTC clock, not user's local wall clock if user relocates/DST |
| Today check | `new Date(); setHours(0,0,0,0)` in `send_reminder` | process-local midnight; additionally missing awaits make check ineffective |
| Debt reminders | schedule raw `collectTime/repaymentTime` | depends on ISO input offset; no zone/reschedule policy |
| Accumulation reminder | UTC parse + fixed +7h | hard-coded Vietnam offset, not user preference |
| Budget messages | Moment `.format()` without timezone | presentation depends on worker/server locale/zone, not financial computation |

V2 user profile needs a validated IANA timezone. A reminder stores local schedule intent + zone and converts to UTC `runAt`; changing timezone reschedules pending reminders by stable key. This timezone must not alter financial occurred/posted dates.

## 5. Business windows and audit time

- Budget `startTime/endTime` are client ISO inputs converted with `new Date`, used with inclusive `$gte/$lte`; end boundary semantics require contract fixtures.
- Transaction date filters likewise use inclusive `fromDate/toDate`; a date-only string can be parsed as UTC midnight and omit most of the intended local end day.
- `createdAt/updatedAt/readAt/receiveAt` mostly use `Date.now`; this is an absolute epoch and should migrate to UTC timestamps after profiling BSON types.
- V1 schemas mix `Joi.date().iso()` and `Joi.date().timestamp('javascript')`; `savings.startDate` is explicitly stored as ISO string while many other fields become driver dates. Actual BSON-type counts are required.

## 6. Required profiling/tests

| Check | Current count | Owner |
|---|---:|---|
| records/jobs produced by TZ-001..006 | saving 0; accumulation 2; Agenda savingId refs 0; accumulationId refs 1 | data/jobs |
| timestamp BSON types per field | Date on transaction/business dates; epoch number on audit/read fields; string on 3/3 user reminder values | migration |
| ISO strings lacking offset / invalid dates | 0 / 0 | migration/API |
| valid timestamps whose UTC day differs from Asia/Ho_Chi_Minh day | 8 | migration/savings; preserve instant and classify business-day intent |
| user IANA timezone missing | 3/3 users | notifications/product; V2 requires validated IANA zone |
| pending reminder intent | Agenda pending 1; all jobs `send_reminder`; jobType notice 3/note 1; accumulationId refs 1 | notifications/product |

Tests required later: UTC midnight boundaries, date-only query ranges, month/year/leap-day, inclusive interest days, sequential periods without double-counted boundary, missed-run catch-up and IANA timezone change/reschedule.

## 7. Findings and decisions

| ID | Finding | Severity/status |
|---|---|---|
| TIME-001 | six fixed UTC+7 compensations mix reminder and financial time. | Source/data classification complete; rules remain mandatory for V2 |
| TIME-002 | no IANA timezone exists on user. | MAJOR; schema/API decision already guided by DEC-049 |
| TIME-003 | saving start-of-day/day calculations use process-local Moment defaults. | CRITICAL interest reproducibility |
| TIME-004 | server-local midnight is used for daily note transaction check. | MAJOR reminder correctness |
| TIME-005 | header occurrence time is client-controlled and validation differs across individual/family/generic paths. | MAJOR contract/migration |
| TIME-006 | Persisted time uses mixed Date/epoch/string representations; 8 valid timestamps cross the UTC vs Asia/Ho_Chi_Minh calendar-day boundary. | PROFILED; preserve instant/provenance and apply explicit UTC/business-date rule |

## 8. Review record

- Coverage: all active hard-coded +7 sites accounted for 6/6; Moment UTC/local, Date constructors, persisted time fields and Agenda timezone call sites classified.
- Financial vs reminder time is explicitly separated per DEC-049.
- No time calculation, environment timezone, stored timestamp or schedule was changed.
- Production profile timestamp `2026-08-01T04:27:39.407Z`; invalid values 0, missing-offset strings 0, cross-calendar-day values 8 and users missing IANA timezone 3/3.
- `git diff --check` is the documentation review gate; no stored timestamp, job or environment timezone was changed.
