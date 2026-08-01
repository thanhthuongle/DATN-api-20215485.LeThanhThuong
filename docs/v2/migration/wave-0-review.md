# Wave 0 Review Record

Ngày review: 2026-08-01. Phạm vi: Phase 0 discovery/V1 behavior freeze. Không triển khai source V2, không thay đổi runtime/data V1 và không bắt đầu Wave 1.

## 1. File đã đọc

### V2 baseline — 22/22 file có sẵn lúc bắt đầu

- `docs/v2/README.md`
- `docs/v2/architecture/admin-operations.md`
- `docs/v2/architecture/api-security-contracts.md`
- `docs/v2/architecture/implementation-guardrails.md`
- `docs/v2/architecture/job-scheduler.md`
- `docs/v2/architecture/overview.md`
- `docs/v2/architecture/periodic-balance-snapshots.md`
- `docs/v2/architecture/transaction-core.md`
- `docs/v2/architecture/transaction-runtime.md`
- `docs/v2/database/design-rules.md`
- `docs/v2/database/interest-rate-rules.md`
- `docs/v2/migration/data-migration-strategy.md`
- `docs/v2/migration/decision-register.md` (DEC-001..DEC-057 và OPEN-005)
- `docs/v2/migration/execution-waves.md`
- `docs/v2/migration/final-migration-strategy.md`
- `docs/v2/migration/financial-invariant-matrix.md`
- `docs/v2/migration/master-plan.md`
- `docs/v2/migration/progress.md`
- `docs/v2/migration/shadow-validation.md`
- `docs/v2/operations/agenda-retirement.md`
- `docs/v2/operations/production-readiness.md`
- `docs/v2/testing/strategy.md`

Đã đọc thêm `CLAUDE.md` và skill review `.agents/skills/nodejs-finance-backend-reviewer/SKILL.md` trước inventory.

### V1 evidence theo task

- Routes/contracts: toàn bộ 14 route files trong `src/routes/`, 14 controller files trong `src/controllers/`, và `src/middlewares/{authMiddleware,cacheStatsMiddleware,errorHandlingMiddleware,familyMiddleware,multerUploadMiddleware}.js`.
- Database/data quality: toàn bộ 26 files trong `src/models/`, model call sites trong services/controllers, `src/config/mongodb.js`, `src/utils/{constants,mongoTransaction,validators}.js`.
- Financial flows: `src/services/{account,accumulation,borrowing,collectionSevice,contribution,expense,income,loan,repayment,saving,transaction,transfer}Service.js` cùng model/detail/route/controller tương ứng.
- Jobs/side effects: `src/agenda/{agenda,loadSystemTasks}.js`, `src/utils/agendaJobNameHelper.js`, các call sites `agenda.schedule/now/every/cancel`, notification service và Cloudinary upload call sites.
- Identity/compatibility: user/auth routes/controllers/services/model, `src/middlewares/authMiddleware.js`, `src/sockets/index.js`, Redis cache files và toàn bộ ObjectId call sites được liệt kê trong `identity-auth-inventory.md`.
- Time/files: toàn bộ hard-coded `.add(7, 'hours')` call sites; `src/providers/CloudinaryProvider.js`, multer middleware và 10 Cloudinary upload sites được liệt kê trong các inventory tương ứng.
- Project/test surface: `package.json`, runtime entry/config files, và repository-wide search cho `test/spec/fixture`; không tìm thấy automated test suite/fixture hay test script.

Danh sách line-level evidence và kết quả của từng nhóm nằm trong các inventory chuyên biệt; review record này không thay thế chúng.

## 2. Acceptance metrics thực tế

| Hạng mục | Kết quả | Gate status |
|---|---:|---|
| V2 baseline docs đọc | 22/22 | PASS |
| Route operations reconciled | 55/55 | PASS |
| Mongo source schemas | 26/26 | PASS |
| Aggregation call sites | 13/13 | PASS |
| Active balance mutation sites | 22/22 | PASS |
| Financial behavior groups | 8 transaction types + opening/close/saving lifecycle | PASS |
| Stored-vs-reconstructed balances | accounts 4/4, accumulations 2/2, savings 0; mismatch/total/max difference 0 VND | PASS production profile |
| Job definitions/call sites | source 4/4 definitions, 8 schedule, 13 now, 2 every, 6 cancel; store 4 active, 1 repeating, 1 pending, 0 locked/failed/duplicate, 4 unversioned | PASS with version/reschedule rule |
| Identity/ObjectId scan | 43 files; 221 constructor calls; 3 validity checks; 13 JWT `_id` consumer files | PASS source inventory |
| Hard-coded UTC+7 compensation | 6/6 sites | PASS |
| Cloudinary lifecycle | 10/10 uploads; DB URLs 24; Cloudinary refs 3; provider 7; missing 0; unreferenced 4; no deletion | PASS with 4 `REQUIRES_REVIEW` |
| Data-quality taxonomy/checks | 20/20 classes with actual counts/owners; 26 direct + 4 composite relation checks | PASS production profile |
| Draft posting templates | 17/17 mutation/lifecycle intents; 0/17 approved | PASS Wave 0 draft; Phase 3 gate remains |
| Draft collection migration rules | 26/26 | PASS Wave 0 draft |
| Automated regression evidence | 0 suites/fixtures/test script found | BLOCKED evidence |

Non-zero findings: 4 unreferenced Cloudinary resources and 4 unversioned Agenda payloads. Both have redacted examples, owner and a non-destructive migration rule.

## 3. Data issues và blockers

- `W0-DATA-ACCESS-001` (`RESOLVED`): production/development read-only profiles completed through an in-memory derived TLS seed list; Node SRV resolver remains an operational quirk.
- `W0-FRONTEND-EVIDENCE-001` (`RESOLVED_FOR_SCOPE`): project owner confirms 55/55 V1 operations remain frontend/migration scope; no access-log telemetry is claimed.
- `W0-TEST-EVIDENCE-001` (`ACCEPTED_LIMITATION`): no automated suite/fixture exists; Phase 2 still owns the test foundation.
- Source risks cần data confirmation: reverse arrays/FKs có thể lệch; mixed BSON cho collection borrower/repayment lender; duplicate business keys không có source-declared unique index; balance/history có gaps do opening/direct saving interest; Cloudinary/Agenda side effects có thể orphan/duplicate.

## 4. Decisions còn mở

`OPEN-005` vẫn mở. Wave 0 bổ sung `OPEN-006..OPEN-011` cho transfer fee, debt settlement, zero amount, family transaction surface, saving-interest reconstruction và cross-space authorization. Không decision nào trong số này được tự động accept.

## 5. Review outcome

W0-01..W0-10 đều đã thực hiện và review tuần tự. Production data profile, 0-VND reconstruction, Agenda/Cloudinary manifest và 55/55 endpoint scope evidence đã được ghi vào outputs. Không còn collection, aggregation, financial mutation, scheduled job hay data-quality class chưa có status/owner.

Validation cuối: `git diff --check`, profiler syntax/read-only scan và metric recount đều pass. `npm.cmd run lint` phản ánh baseline V1 chưa sạch với 46 issues (13 errors, 33 warnings); không issue nào được auto-fix vì Wave 0 không được sửa source V1. Repository không có test script để chạy.

Kết luận: **Wave 0 / Phase 0 đạt `READY_FOR_REVIEW`**. Trạng thái chưa chuyển `COMPLETED` vì còn project-owner sign-off; Wave 1 chưa được mở.
