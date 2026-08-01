# Tiến độ Migration V2

Ngày khởi tạo tài liệu: 2026-07-31

## Trạng thái hợp lệ

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `READY_FOR_REVIEW`
- `COMPLETED`

## Tổng quan

### Execution waves

| Wave | Phạm vi | Trạng thái |
|---|---|---|
| Wave 0 | Phase 0 - Discovery/V1 freeze | COMPLETED |
| Wave 1 | Phase 1-2 - API và staging foundation | IN_PROGRESS |
| Wave 2 | Phase 3 - PostgreSQL design freeze | NOT_STARTED |
| Wave 3 | Phase 4-4B - Financial kernel | NOT_STARTED |
| Wave 4A | Phase 5 - Foundation modules | NOT_STARTED |
| Wave 4B | Phase 6 - Sources/accounts | NOT_STARTED |
| Wave 4C | Phase 7 - Income/expense/transfer | NOT_STARTED |
| Wave 4D | Phase 7 - Debt/advanced commands | NOT_STARTED |
| Wave 4E | Phase 7 - Time-based savings | NOT_STARTED |
| Wave 5 | Phase 8-9 - Read models/operations | NOT_STARTED |
| Wave 6 | Phase 10-10B - Migration/differential validation | NOT_STARTED |
| Wave 7 | Phase 11 - Release candidate | NOT_STARTED |
| Wave 8 | Phase 12 - Cutover/hypercare | NOT_STARTED |
| Wave 9 | Phase 13-15 - Agenda/MongoDB retirement | NOT_STARTED |

### Phases

| Phase | Nội dung | Trạng thái |
|---|---|---|
| Documentation baseline | Ghi nhận kiến trúc và kế hoạch đã thống nhất | COMPLETED |
| Phase 0 | Inventory và đóng băng hành vi V1 | COMPLETED |
| Phase 1 | API versioning | IN_PROGRESS |
| Phase 2 | PostgreSQL staging foundation | NOT_STARTED |
| Phase 3 | PostgreSQL data model | NOT_STARTED |
| Phase 4 | Transaction core | NOT_STARTED |
| Phase 4B | Periodic balance snapshot core | NOT_STARTED |
| Phase 5 | Các module nền tảng | NOT_STARTED |
| Phase 6 | Nguồn tiền | NOT_STARTED |
| Phase 7 | Transaction endpoints | NOT_STARTED |
| Phase 8 | Query, aggregation và báo cáo | NOT_STARTED |
| Phase 9 | Budget, cache, notification và jobs | NOT_STARTED |
| Phase 10 | Data migration pipeline | NOT_STARTED |
| Phase 10B | Differential replay và shadow validation | NOT_STARTED |
| Phase 11 | Parity, UAT và security review | NOT_STARTED |
| Phase 12 | Production cutover | NOT_STARTED |
| Phase 13 | Agenda 5 -> Agenda 6 với MongoDB backend | NOT_STARTED |
| Phase 14 | Agenda 6 MongoDB -> PostgreSQL backend | NOT_STARTED |
| Phase 15 | MongoDB retirement | NOT_STARTED |

## Wave/phase đang hoạt động

Wave 0 / Phase 0 đã được project owner sign-off và chuyển `COMPLETED` ngày 2026-08-01 sau khi đạt toàn bộ source/data inventory exit metrics. Wave 1 / Phase 1 được mở theo yêu cầu của project owner; Phase 2 chỉ được mở sau khi Phase 1 đạt exit criteria và được nghiệm thu.

## Wave 1 task register

Các task Wave 1 được thực hiện tuần tự. Task kế tiếp chỉ được mở sau khi implementation, verification và diff của task hiện tại đã được review.

| Task | Phase | Phạm vi | Trạng thái | Evidence/review |
|---|---|---|---|---|
| W1-01 | Phase 1 | API boundary, legacy URL, `/api/v1`, `/api/v2/health` | IN_PROGRESS | Pending implementation/review |
| W1-02 | Phase 1 | Feature-flag registry và fail-closed write flags | NOT_STARTED | Chờ W1-01 |
| W1-03 | Phase 1 | OpenAPI V1 baseline skeleton và approved differences | NOT_STARTED | Chờ W1-02 |
| W1-04 | Phase 1 | Boundary/contract/V1 regression gate | NOT_STARTED | Chờ W1-03 |
| W1-05 | Phase 2 | Docker Compose và local/staging isolation config | NOT_STARTED | Chờ Phase 1 sign-off |
| W1-06 | Phase 2 | Prisma client, migration/seed commands và PostgreSQL health | NOT_STARTED | Chờ W1-05 |
| W1-07 | Phase 2 | Node 20+, Vitest, Supertest và Testcontainers foundation | NOT_STARTED | Chờ W1-06 |
| W1-08 | Phase 2 | JobScheduler, Agenda 5 adapter/store isolation và registry | NOT_STARTED | Chờ W1-07 |
| W1-09 | Phase 2 | Side-effect isolation, observability và flag conventions | NOT_STARTED | Chờ W1-08 |
| W1-10 | Phase 2 | Local/staging health, isolation và V1 regression gate | NOT_STARTED | Chờ W1-09 |

## Wave 0 task register

Các task được mở tuần tự. Một task chỉ chuyển `COMPLETED` sau khi evidence và diff tài liệu của chính task đó đã được review; task kế tiếp giữ `NOT_STARTED` cho đến lúc đó.

| Task | Phạm vi | Trạng thái | Evidence/output | Review |
|---|---|---|---|---|
| W0-01 | Routes, middleware và API contracts | COMPLETED | `docs/v2/migration/endpoint-inventory.md` | Reviewed: 55/55 source operations reconciled; `git diff --check` passed |
| W0-02 | MongoDB collections, fields, embedded documents, relations và aggregations | COMPLETED | `docs/v2/database/mongodb-inventory.md` | Reviewed: 26/26 schemas, 13/13 aggregate call sites; `git diff --check` passed |
| W0-03 | Financial flows và mọi vị trí thay đổi balance | COMPLETED | `docs/v2/migration/financial-flows.md` | Reviewed: 22/22 active mutation sites; 8 transaction types + opening/close/saving lifecycle covered |
| W0-04 | Reconstruct transaction-history balance và so sánh stored balance | COMPLETED | `docs/v2/database/data-quality-report.md`, read-only profiler | Reviewed production: accounts 4/4, accumulations 2/2, savings 0; mismatches 0; total/max difference 0 VND |
| W0-05 | Scheduled jobs, Agenda store và external side effects | COMPLETED | `docs/v2/migration/background-jobs.md` | Reviewed: source 4/4 definitions, 8 schedule, 13 now, 2 every, 6 cancel; store 4 active, 1 repeating, 1 pending, 0 locked/failed/duplicate |
| W0-06 | JWT, refresh token, Socket và ObjectId compatibility | COMPLETED | `docs/v2/migration/identity-auth-inventory.md` | Reviewed: HTTP/refresh/cookie/Socket/cache/Agenda IDs; 43 ObjectId files, 221 constructor calls |
| W0-07 | UTC/timezone compensation | COMPLETED | `docs/v2/migration/timezone-inventory.md` | Reviewed: 6/6 hard-coded +7h sites; financial/reminder/audit time classified |
| W0-08 | Cloudinary/file lifecycle | COMPLETED | `docs/v2/migration/file-lifecycle-inventory.md` | Reviewed: 10/10 upload sites; DB refs 24, provider resources 7, missing at provider 0, provider orphans 4; no deletion executed |
| W0-09 | Data quality, orphan và duplicate | COMPLETED | `docs/v2/database/data-quality-report.md`, read-only profiler | Reviewed production: 20/20 classes have counts/owners; 26 direct + 4 composite relation checks; 2 non-zero classes classified |
| W0-10 | Draft posting/invariant matrix và migration rules | COMPLETED | `docs/v2/migration/financial-invariant-matrix.md`, `docs/v2/migration/migration-rule-catalog.md` | Reviewed: 17/17 draft templates, 26/26 collection rules, OPEN-006..011 registered; syntax/diff/metric checks passed |

### Wave 0 scope freeze và baseline

- Working tree lúc bắt đầu: sạch trên nhánh `API_V2` (`git status --short --branch` chỉ báo branch; không có modified/untracked file).
- Đã đọc: `CLAUDE.md` và toàn bộ 22 file Markdown có sẵn dưới `docs/v2/` lúc bắt đầu, gồm toàn bộ `decision-register.md` (DEC-001..DEC-057 và OPEN-005). Danh sách cụ thể ở `wave-0-review.md`.
- Giới hạn thay đổi: chỉ tài liệu dưới `docs/v2/`; không sửa `src/`, `build/`, cấu hình runtime, dependency hoặc dữ liệu V1.
- Quyết định áp dụng trực tiếp: DEC-001, DEC-003, DEC-007..DEC-016, DEC-020..DEC-024, DEC-030..DEC-032, DEC-036..DEC-038, DEC-042..DEC-045, DEC-049, DEC-053, DEC-056..DEC-057.

## Phase 0 checklist

- [x] Inventory routes, methods và middleware.
- [x] Inventory request/response/error contracts.
- [x] Inventory MongoDB collections và fields.
- [x] Profile kiểu dữ liệu thực tế, missing/null, duplicate và orphan relationships.
- [x] Inventory aggregation pipelines.
- [x] Inventory financial flows và balance mutations.
- [x] Reconstruct transaction-history balances và so với stored account balances, tolerance 0 VND.
- [x] Tạo draft financial invariant/posting template matrix cho 100% financial flows.
- [x] Inventory scheduled jobs và external side effects.
- [x] Inventory Agenda business/job store coupling và kế hoạch credential/database riêng.
- [x] Inventory JWT/refresh/Socket ObjectId claims và frontend cached IDs cho force logout/UUID transition.
- [x] Inventory hard-coded timezone compensation và phân loại financial UTC với user reminders.
- [x] Inventory Cloudinary/file lifecycle và orphan side effects.
- [x] Tạo draft migration rules cho embedded documents, arrays, ObjectId, orphan, duplicate và invalid legacy data.
- [x] Xác định endpoint frontend đang sử dụng: project owner xác nhận 55/55 V1 operations thuộc frontend/migration scope; không tuyên bố có access-log telemetry.
- [x] Ghi chính sách feature freeze cho V1.

## V1 feature-freeze policy

- Theo DEC-014, trong thời gian phát triển V2 không thêm feature hoặc thay đổi contract/behavior V1; chỉ nhận production bug/security fix có evidence, owner, regression scope và rollback plan.
- Mọi V1 fix liên quan money, identity, time, jobs, file hoặc data shape phải cập nhật inventory/differential baseline và đánh giá lại migration rule bị ảnh hưởng.
- Freeze này không làm V1 read-only trong giai đoạn build; final write/job freeze chỉ diễn ra tại maintenance cutover theo DEC-003/043 và `final-migration-strategy.md`.
- Wave 0 chỉ ghi policy. Không source/config/data V1 nào được sửa trong task này.

## Wave 0 acceptance metrics

| Metric | Actual | Trạng thái |
|---|---:|---|
| Baseline V2 documents read | 22/22 | PASS |
| Source route operations | 55/55 | PASS |
| Mongo source schemas / aggregations | 26/26; 13/13 | PASS |
| Active balance mutation sites | 22/22 | PASS |
| Actual stored-vs-reconstructed balance | 6/6 matched; 0 mismatches; total/max difference 0 VND | PASS production profile |
| Jobs | source: 4 definitions, 8 schedule, 13 now, 2 every, 6 cancel; store: 4 active, 1 repeating, 1 pending, 0 locked/stale/failed/duplicate | PASS |
| Identity/ObjectId | 43 files; 221 constructors; 3 validity checks; 13 JWT `_id` consumers; all client V1 state force-cleared by scope rule | PASS source/scope |
| Hard-coded timezone compensation | 6/6; saving affected 0, accumulations 2, pending accumulation reminder 1; invalid time 0, UTC/local-day difference 8, missing IANA timezone 3/3 users | PASS profile/rule |
| Cloudinary upload/delete inventory | 10/10 uploads; DB refs 24; provider 7; missing 0; unreferenced provider resources 4; 0 delete/cleanup | PASS with 4 `REQUIRES_REVIEW` |
| Data-quality checks | 20/20 classes with actual counts/owners; 26 direct + 4 composite relations; missing/duplicate/orphan financial relations 0 | PASS production profile |
| Draft posting templates | 17/17; approved 0/17 | PASS Wave 0 draft |
| Draft collection migration rules | 26/26 | PASS Wave 0 draft |

Chi tiết evidence, file đã đọc và review outcome nằm ở `wave-0-review.md`.

## Blockers

- `W0-DATA-ACCESS-001` (`RESOLVED` 2026-08-01): Node SRV resolver vẫn lỗi nhưng read-only production/development profiles đã chạy thành công qua TLS seed list được derive trong memory từ Atlas DNS. Không credential nào được ghi vào report.
- `W0-FRONTEND-EVIDENCE-001` (`RESOLVED_FOR_SCOPE` 2026-08-01): project owner xác nhận 55/55 V1 operations đều được frontend sử dụng và phải nằm trong migration scope. Không có per-endpoint traffic telemetry; không endpoint nào được deprecate dựa trên thiếu log.
- `W0-TEST-EVIDENCE-001` (`ACCEPTED_LIMITATION`): repo không có test/spec/fixture hoặc test script. Wave 0 dùng route/model/service evidence và read-only production profile; test foundation vẫn là entry work của Phase 2 và không được coi là đã hoàn thành sớm.

Không còn blocker Wave 0 chưa phân loại. Hai non-zero data issues là 4 provider-orphan assets (`REQUIRES_REVIEW`, không xóa) và 4 unversioned Agenda payloads (reschedule/version rule); cả hai có count, example, owner và remediation rule nên không là unresolved `BLOCKING` discrepancy.

## Quyết định còn mở

- `OPEN-005`: PostgreSQL production hosting/configuration.
- `OPEN-006`: transfer fee semantics.
- `OPEN-007`: repayment/collection full hay partial settlement và interest representation.
- `OPEN-008`: zero-amount command policy.
- `OPEN-009`: giữ/sửa/deprecate family financial endpoints sau frontend/traffic evidence.
- `OPEN-010`: reconstruction cho direct saving-interest credits.
- `OPEN-011`: cross-owner/cross-financial-space transfer/contribution policy.

Các decision mới chỉ được đăng ký `Open` trong `decision-register.md`; chưa decision nào được ngầm phê duyệt.

## Validation đã chạy

| Check | Kết quả |
|---|---|
| `git diff --check` | PASS; chỉ có line-ending warning LF/CRLF của Git trên Windows |
| `node --check docs/v2/migration/scripts/v1-readonly-profile.mjs` | PASS |
| Static profiler write-operation scan | PASS; không có insert/update/delete/drop/create-index call |
| Source metric recount | PASS: routes 55, models 26, aggregates 13, +7h 6, Agenda 8/13/2/6, `new ObjectId` 221, `ObjectId.isValid` 3 |
| Draft catalog recount | PASS: 17 posting templates, 26 collection migration rules |
| `npm.cmd run lint` | FAIL baseline V1: 46 issues (13 errors, 33 warnings), chủ yếu unused disable/variables; không sửa source trong Wave 0 |
| Mongo profiler v2 execution | PASS production via derived TLS seed list; `listCollections`/`countDocuments`/`find`/`listIndexes` only; no credential recorded |
| Cloudinary manifest comparison | PASS read-only: DB refs 3/3 resolve; provider resources 7; unreferenced 4; no upload/delete |

Không có automated test script để chạy. Baseline lint failure không phát sinh từ Wave 0 docs/script và chưa được auto-fix. Không có commit/push trong lượt triển khai này.

## Gates đã biết

- Phase 4 chờ approved posting/invariant matrix và explicit transaction-context design.
- Phase 10B chờ đóng `OPEN-005`, production hosting/connection mode, RPO/RTO/PITR và restore procedure.
- Phase 12 chờ Agenda store isolation, deterministic full-reload rehearsal, force-logout plan và `0 BLOCKING` discrepancy.

## Quy tắc cập nhật

- Chỉ đánh dấu phase `COMPLETED` khi đạt exit criteria trong `master-plan.md`.
- Chỉ đánh dấu wave `COMPLETED` khi toàn bộ phase/sub-wave trong scope đạt sign-off theo `execution-waves.md`.
- Mỗi thời điểm chỉ có một wave chính `IN_PROGRESS`; không mở task mới chạm cùng schema/core trước khi task hiện tại review xong.
- Ghi blocker và quyết định phát sinh trước khi tiếp tục phase phụ thuộc.
- Mỗi lần hoàn thành task phải cập nhật checklist, validation/test đã chạy và commit liên quan nếu được yêu cầu; Wave 0 hiện không commit theo chỉ thị người dùng.
- Mỗi phase phải ghi acceptance metrics thực tế, đường dẫn evidence/report và approved exceptions trước khi chuyển `COMPLETED`.
