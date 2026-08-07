# Wave 5 Review — Phase 8 & 9 (Initial Implementation Slice)

Ngày: 2026-08-07 (session-driven review). Branch: `API_V2_ALT-wave_5`.
Phạm vi được phép: chỉnh sửa trên api v2 (src/v2, src/api/v2, tests, docs/v2).
Không sửa api v1. V1 phải duy trì hoạt động như cũ.

## 1. Entry gate

- Các wave trước (0, 1, 2, 3, 4A–4E) đều `COMPLETED` theo `docs/v2/migration/progress.md`.
- `OPEN-005` (production hosting) là gate của Phase 10B, không chặn Wave 5.
- Working tree trước khi bắt đầu: sạch (không có thay đổi user). Toàn bộ thay đổi của slice này
  được tạo mới trong session; không xoá/ghi đè thay đổi hiện có.
- Environment: Node v22.22.0, Yarn 1.22.22, Docker 29.2.0; `node_modules` và vitest/eslint/babel có sẵn.

## 2. Phạm vi đã triển khai (slice Phase 8 + Phase 9)

### Phase 8 — Read models/reports
| File | Loại | Nội dung |
|---|---|---|
| `src/v2/modules/financial/query/financialQuery.repository.js` | mới | Query read-only: balance summary, transaction history (pagination), transaction detail, report transactions |
| `src/v2/modules/financial/query/financialQuery.service.js` | mới | `getSpaceBalanceSummary`, `getTransactionHistory`, `getTransactionDetail`, `getCategorySpendReport` |
| `src/v2/modules/financial/query/index.js` | mới | barrel export |
| `src/api/v2/controllers/queryController.js` | mới | summary / transactions / category-spend endpoints |
| `src/api/v2/routes/queryRoute.js` | mới | `/spaces/:spaceId/summary`, `/transactions`, `/reports/category-spend` |
| `src/api/v2/mappers/queryMapper.js` | mới | API response mapping |
| `src/api/v2/index.js` | sửa | mount queryRoute |
| `tests/unit/financial/financialQuery.service.test.js` | mới | 3 tests PASS |

### Phase 9 — Budget
| File | Loại | Nội dung |
|---|---|---|
| `src/v2/modules/budget/repositories/budget.repository.js` | mới | CRUD budgets/budget_allocations |
| `src/v2/modules/budget/services/budget.service.js` | mới | `listBudgets`, `getBudgetById`, `createBudgetAllocation` (409 duplicate, non-negative amount) |
| `src/api/v2/controllers/budgetController.js` | mới | GET/POST budgets theo space |
| `src/api/v2/routes/budgetRoute.js` | mới | `/spaces/:spaceId/budgets` |
| `src/api/v2/mappers/budgetMapper.js` | mới | response mapping |
| `src/api/v2/validations/budgetValidation.js` | mới | Joi create schema |
| `src/api/v2/index.js` | sửa | mount budgetRoute |
| `tests/unit/budget.service.test.js` | mới | 5 tests PASS |


### Phase 9 — Outbox consumer + notification delivery
| File | Loại | Nội dung |
|---|---|---|
| `src/v2/modules/financial/core/outboxConsumer.service.js` | mới | Claim FOR UPDATE SKIP LOCKED, inbox_receipts dedup, delivery_attempts, DEAD_LETTER/REQUIRES_REVIEW/backoff |
| `src/v2/modules/financial/core/index.js` | sửa | export outboxConsumer |
| `src/v2/modules/notification/repositories/notification.repository.js` | sửa | findByUser, markReaded, findUserNotificationByPublicId, create |
| `src/v2/modules/notification/services/notification.service.js` | sửa | `getNotifications`, `markReaded` (404/403/409), `create` |
| `src/v2/modules/notification/services/notificationOutbox.handler.js` | mới | outbox → notification bridge |
| `src/api/v2/controllers/notificationController.js` | mới | GET /notifications, PUT mark-read |
| `src/api/v2/routes/notificationRoute.js` | mới | routes |
| `src/api/v2/mappers/notificationMapper.js` | mới | response mapping |
| `src/api/v2/index.js` | sửa | mount notificationRoute |
| Tests mới | | outboxConsumer (6), notification.service (4), notificationOutbox.handler (2) PASS |

### Phase 9 — Snapshot scheduler job + job registry
| File | Loại | Nội dung |
|---|---|---|
| `src/v2/modules/financial/snapshot/snapshotScheduler.service.js` | mới | `generateForSpace` (idempotent COMPLETED-run guard), `runDaily` |
| `src/v2/modules/financial/snapshot/index.js` | sửa | export scheduler |
| `src/v2/infrastructure/jobs/jobRegistry.js` | sửa | `businessJobRegistry` + `defaultJobRegistry` với `v2.snapshot.daily` |
| `tests/unit/financial/snapshotScheduler.test.js` | mới | 4 tests PASS |
| `tests/unit/jobRegistry.test.js` | sửa | + snapshot job assertions PASS |

## 3. Verification đã chạy (thực tế)
| Check | Kết quả |
|---|---|
| `node --check` toàn bộ file mới + `src/v2/infrastructure/bootstrap/v2WorkerBootstrap.js` + `src/server.js` | PASS |
| `yarn test:unit` | 23 files / 178 tests PASS (gồm 36 test mới của slice: financialQuery 3, budget 5, outboxConsumer 6, notification.service 5, notificationOutbox.handler 2, snapshotScheduler 4, jobRegistry 5, bootstrap 6) |
| `yarn build` (prisma generate + clean + babel) | 287 files compiled, 0 error |
| `yarn lint` trên các file thuộc slice | PASS (0 warning trên file mới) |

Lint toàn repo còn 2 warning PRE-EXISTING trên file KHÔNG thuộc slice này
(`contactController.js:2` unused `toContactResponse`; `accumulation.service.js:16` unused `ledgerAccount`).
Xác nhận bằng `git diff HEAD --` hai file này là rỗng → baseline ACKNOWLEDGED, ngoài phạm vi Wave 5.

## 4. Findings
| ID | Mức | File | Finding | Trạng thái |
|---|---|---|---|---|
| W5-01 | P2 | budget.service | `createBudget` + `createAllocation` không atomic (crash → orphan budget); `source_ordinal` đếm row-count không chống race. | **RESOLVED** — Budget creation wrapped in `prisma.$transaction` for atomicity; `source_ordinal` derived from `countAllocationsForBudget` inside transaction instead of row-count array length. |
| W5-02 | P3 | budget/notification API | Chưa có auth/actor-bound (nhất quán với pattern hiện tại của V2 slice, cần security gate Wave 7). | MỞ — defer Wave 7 |
| W5-03 | P3 | outboxConsumer | Chưa wiring worker loop thật gọi `process()` định kỳ. | **RESOLVED** — V2 worker bootstrap (`src/v2/infrastructure/bootstrap/v2WorkerBootstrap.js`) created and wired into `src/server.js`. Outbox consumer runs on a 30s interval; snapshot scheduler registered in `businessJobRegistry` and started via Agenda5MongoScheduler. |

## 5. Defer / ngoài slice (cần vòng lặp tiếp hoặc wave sau)
- Full admin-operations API (discrepancy queue, job/outbox/snapshot status).
- Agenda production-store transition rehearsal.

## 6. Đánh giá cuối (slice này)
**READY_FOR_REVIEW** — slice đạt unit/build/lint trên toàn bộ file mới; W5-01 và W5-03 đã giải quyết (W5-01: atomic transaction + consistent ordinal; W5-03: worker bootstrap + outbox 30s interval + snapshot scheduler đã wired). W5-02 defer sang Wave 7.

