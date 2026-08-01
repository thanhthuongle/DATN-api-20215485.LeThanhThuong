# V1 Background Jobs, Agenda Store and External Side Effects Inventory

Ngày inventory: 2026-08-01.

## 1. Agenda runtime/store

| Item | V1 evidence | Status/owner |
|---|---|---|
| Package | `agenda ^5.0.0` in `package.json` | Agenda platform / ACTIVE |
| Bootstrap | all files under `src/systemTasks` are synchronously required, then `agenda.start()`; shutdown calls `agenda.stop()` | server/platform / ACTIVE |
| Poll interval | `processEvery: '30 seconds'` | platform / ACTIVE |
| Store | address is built from the same `env.MONGODB_URI` and `env.DATABASE_NAME` as business MongoDB; collection hard-coded `system_tasks` | **COUPLED** |
| Credential isolation | no `AGENDA_MONGODB_URI` or `AGENDA_DATABASE_NAME` env fields | MISSING; DEC-045 blocker before cutover; V2 code owns collection `v2_jobs` |
| Worker isolation | no worker ID/fence/staging namespace in source | MISSING |
| Job options | no definition declares concurrency, lockLifetime, priority, timeout or retry/backoff | Agenda defaults/unknown |
| Stable uniqueness | helper creates string in payload for two producers, but no `job.unique()`/unique query is applied | NOT ENFORCED |
| Actual production store | 4 total/active; repeating 1; pending 1; locked/stale/failed 0; duplicate stable-signature groups 0; unknown names 0; unversioned payloads 4 | Profiled `2026-08-01T04:02:38.629Z`; all four records are `send_reminder` |

`src/models/systemTaskModel.js` defines an application Joi schema named `system_tasks`, but no code uses that model for persistence. Agenda owns the actual collection document shape; the Joi schema must not be treated as Agenda store schema.

## 2. Job definition registry

Source defines exactly **4 Agenda job names**.

| Job/owner | Payload observed | Producers/schedule | Financial write | Side effects | Error/retry behavior | Status |
|---|---|---|---|---|---|---|
| `send_reminder` / notifications | userId, title, message; optional jobType, link, saving/loan/borrowing/accumulation IDs | `every` daily user note; `schedule` debt/accumulation; `now` budget/test/saving notifications | no direct balance | creates notification + user_notification, emits Socket event | catches/logs all errors, does not rethrow; missing `await` on user and daily transaction reads | ACTIVE, HIGH RISK |
| `monthly_saving_solver` / savings | userId, savingId, `stt` | saving creation/rollover `now` or +3 sec bootstrap; solver schedules next month with `startDate + n months + 7h` | **yes** via receiveMonthlyInterest/rollover | creates further jobs/notifications | catches/logs; no stable uniqueness/idempotency; catch-up loop can execute many financial periods | ACTIVE FINANCIAL, BLOCKING design gap |
| `maturity_saving_solver` / savings | userId, savingId | saving creation/rollover bootstrap; self-schedules maturity `+7h` | **yes** via maturity interest/rollover | schedules reminder/next solver | catches/logs; no stable uniqueness/idempotency | ACTIVE FINANCIAL, BLOCKING design gap |
| `receive_interest` / savings | userId, savingId | no producer found in active source | intended financial | cancel/query Agenda | missing `await` on reads and calls nonexistent `savingService.receiveInterest`; errors swallowed | DEFINED_UNREACHABLE/BROKEN; archive-or-migrate decision required |

Job-definition coverage review: four `agenda.define()` calls in four files, all listed above.

## 3. Producer/cancel inventory

| Producer/cancel source | Intent | Boundary and stable-key evidence | Owner/status |
|---|---|---|---|
| `userService.verifyAccount` | daily note reminder via `agenda.every`, UTC cron | after user update; generated `jobName` only inside data; no uniqueness enforcement | identity/notifications |
| `userService.update` | cancel/recreate note reminder | matches name+userId+jobType; new payload omits generated jobName | identity/notifications |
| `accumulationService.createIndividualAccumulation` | end-date reminder | scheduled **inside Mongo transaction**, runAt hard-coded `+7h`; no stable key | accumulations |
| `accumulationService.finishIndividualAccumulation` | cancel end reminder | after transfer/status, matches `data.accumulationId` | accumulations |
| `loanService.createNew` | collection reminder | scheduled **inside financial Mongo transaction**; payload jobType NOTICE; no stable key | debt |
| `borrowingService.createNew` | repayment reminder | scheduled **inside financial transaction**; generated jobName in payload only | debt |
| `repaymentService.createNew` / `collectionSevice.createNew` | cancel debt reminder | cancellation **inside financial transaction** | debt |
| `budgetService.createIndividualBudget` | immediate over-limit notice | `finally`, after session; non-financial notification | budgets |
| `budgetService.checkAndNotifyOverLimitBudget` | immediate over-limit notice after expense | Agenda `now` can execute inside caller financial retry callback | budgets/transactions |
| `savingService.createIndividualSaving` | bootstrap monthly/maturity solver after commit | schedule at now+3 sec; no stable unique key | savings |
| saving rollover methods | bootstrap next solver | `agenda.now` after transaction | savings |
| `savingService.closeSaving` | cancel all saving jobs | after session, matches `data.savingId` | savings |
| monthly/maturity solver | self-schedule/notify/catch-up | raw schedules, no dedup key | savings |
| `notificationController.testSocketIO` | immediate test notification through GET | public mounted authenticated endpoint; raw Agenda result returned | notifications; deprecate/production decision |

Static call-site totals (excluding a JSDoc mention of `agenda.define`): 4 definitions; 8 `schedule` sites; 13 `now` sites; 2 `every` sites; 6 `cancel` sites; plus start/stop lifecycle.

## 4. Scheduled financial flows

| Flow | Balance mutation evidence | Idempotency/retry assessment | Required V2 rule owner |
|---|---|---|---|
| Monthly interest payout | direct saving `+interest` without session, then transfer | retry can mint/re-transfer; no stable financial key | savings transaction template + scheduler stable key |
| Maturity interest payout | direct saving `+interest`, then transfer | same; no durable completion marker | savings transaction template |
| Roll over principal | old -> new saving transfer and close inside transaction | job retry can create another child saving; parent/isClosed checks help only after successful commit | savings rollover key `(saving, maturity period, action)` |
| Roll over principal+interest | direct interest inside transaction, transfer to new saving, close | DB write is grouped, but retry/Agenda duplicates lack explicit idempotency | savings rollover key |
| Monthly catch-up | loop executes every missed `stt` sequentially | no per-period durable idempotency; partial loop rerun can repeat earlier periods | savings period registry/discrepancy owner |

No scheduled financial flow calls a centralized transaction core because V1 has none. All five behaviors are Phase 0 inventory items and must map to posting templates/jobs under DEC-015/038.

## 5. External side-effect register

| Provider/store | Call sites/trigger | DB ordering | Failure/duplicate/orphan risk | Owner/status |
|---|---|---|---|---|
| Brevo email | registration verification | after user/categories/money-source writes, no shared transaction/outbox | email failure returns error after account exists; retry can conflict and not resend | identity/messaging |
| Cloudinary upload | user avatar, family background, eight transaction subtype services | before corresponding DB update/detail insert; transaction uploads inside retry callback | upload success + DB abort leaves orphan; retries upload duplicates; no delete | assets (W0-08 detail) |
| Socket.IO | notificationService emits after two Mongo inserts | after DB writes, no outbox | emit failure may make request fail after notification persisted; reconnect delivery absent | notifications |
| Agenda Mongo store | every schedule/now/cancel/start | sometimes inside business transaction, but different Agenda connection/commit | business abort can leave job; cancellation can succeed before business abort; duplicate schedules | jobs/platform |
| Redis | bank/category cache set/get/invalidate | cache writes after reads; category invalidations around model operations | namespace is unversioned; cache failure swallowed; no cross-version isolation | cache/platform |
| Console/logs | job handlers, cache, server | independent | handlers swallow errors and Agenda may observe successful completion | observability |

## 6. Critical issues and migration rules

| ID | Finding | Severity | Rule/owner |
|---|---|---|---|
| JOB-001 | Agenda uses business Mongo URI/database/credential and `system_tasks`. | BLOCKING before cutover | Platform: isolate store/credential per DEC-045; inventory/reschedule stable keys, never copy lock state. |
| JOB-002 | Financial jobs have no explicit idempotency key or durable period completion. | CRITICAL financial integrity | Savings/core: transaction core + permanent job idempotency. |
| JOB-003 | Handlers catch errors and do not rethrow; failures can be marked complete. | MAJOR operations | Job platform: classified retry/backoff/dead-letter/discrepancy. |
| JOB-004 | Missing awaits in `send_reminder` and `receive_interest`; stale handler calls nonexistent service. | MAJOR correctness | Notifications/savings: test and archive-or-fix decision; no silent migration. |
| JOB-005 | Agenda schedule/cancel and Cloudinary occur inside retried Mongo transactions. | CRITICAL consistency | Outbox/job/asset owners: after-commit dispatch and compensating cleanup. |
| JOB-006 | No staging/production worker/store namespace is evidenced. | BLOCKING isolation | Platform: separate DB/collection/credential/worker identity. |
| JOB-007 | User reminder stores UTC cron from one fixed timestamp but no IANA timezone. | MAJOR time behavior | Identity/notification: UTC runAt from validated IANA timezone; reschedule on change. |
| JOB-008 | Actual store contains 4 active `send_reminder` records; all payloads lack schema version. | MAJOR migration compatibility | Platform: assign payload version and reschedule intent by stable key; do not copy internal documents/locks. |

## 7. Agenda isolation transition draft (Wave 0 only)

1. Capture read-only manifest: job name, payload version/type, nextRunAt, repeatInterval/timezone, lockedAt/lastRunAt/fail state and stable business identity; redact message/PII.
2. Define stable key per registry item and decide archive for `receive_interest`/test jobs.
3. Provision separate Agenda database/collection/user with no business-collection write permission.
4. In a later authorized phase/rehearsal: stop old workers, drain locks/in-flight jobs, reschedule intent by stable key, start exactly one new fleet, reconcile counts/next run; never copy internal locks blindly.
5. Keep financial idempotency in transaction core independent of scheduler dedup.

No transition was executed in Wave 0.

## 8. Review record

- Coverage: all 4 definitions and all Agenda producer/cancel/start/stop call sites classified; financial/non-financial ownership recorded.
- Side effects: Brevo, Cloudinary, Socket, Redis, Agenda and logging paths recorded.
- Actual store review: four `send_reminder` records (`6866095d29cbf2ee079ec5a5`, `68660bab29cbf2ee079ec5a6`, `69af845b5b564b21f80df6b9`, `6a33b645f1e60733b2fdfeb5`) are active and unversioned; no lock, failure, unknown name or duplicate stable signature was observed.
- Live-store metric blocker is resolved for Wave 0. Re-profile at freeze because Agenda remains active and production counts can change.
- Diff review: documentation only; no job, store, worker, credential or V1 runtime changed.
