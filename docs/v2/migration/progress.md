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
| Wave 1 | Phase 1-2 - API và staging foundation | READY_FOR_REVIEW |
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
| Phase 1 | API versioning | COMPLETED |
| Phase 2 | PostgreSQL staging foundation | READY_FOR_REVIEW |
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

Wave 0 / Phase 0 đã được project owner sign-off và chuyển `COMPLETED` ngày 2026-08-01. Wave 1 Phase 1 đã đạt exit criteria và `COMPLETED`; Phase 2 implementation/local verification, Supabase least-privilege/TLS và Agenda staging isolation/execution đều PASS. Phase 2/Wave 1 hiện `READY_FOR_REVIEW`, chưa `COMPLETED`; Wave 2 chưa được mở.

## Wave 1 task register

Các task Wave 1 được thực hiện tuần tự. Task kế tiếp chỉ được mở sau khi implementation, verification và diff của task hiện tại đã được review.

| Task | Phase | Phạm vi | Trạng thái | Evidence/review |
|---|---|---|---|---|
| W1-01 | Phase 1 | API boundary, legacy URL, `/api/v1`, `/api/v2/health` | COMPLETED | Reviewed: build + targeted lint PASS; 55 V1 operations; legacy `/status` = `/api/v1/status`; gated V2 health PASS |
| W1-02 | Phase 1 | Feature-flag registry và fail-closed write flags | COMPLETED | Reviewed: 6 write flags default off; write-authority/dependency/malformed-config fail-closed tests PASS; `src/v2` Express scan clean |
| W1-03 | Phase 1 | OpenAPI V1 baseline skeleton và approved differences | COMPLETED | Reviewed: valid YAML; 44 paths/55 unique operations; 0 approved differences; candidates remain unapproved |
| W1-04 | Phase 1 | Boundary/contract/V1 regression gate | COMPLETED | Phase 1 accepted: aggregate verification, full lint, build and source-boundary regression PASS |
| W1-05 | Phase 2 | Docker Compose và local/staging isolation config | COMPLETED | Reviewed: Compose config PASS; PostgreSQL 16, Redis 7, Agenda MongoDB 7 all healthy; staging placeholders/isolation documented |
| W1-06 | Phase 2 | Prisma client, migration/seed commands và PostgreSQL health | COMPLETED | Reviewed/refreshed: Prisma 7.9.1 + pg adapter validate/generate; one infrastructure migration; seed; local health 82ms; 0 business tables; V1 stays CommonJS |
| W1-07 | Phase 2 | Node 20+, Vitest, Supertest và Testcontainers foundation | COMPLETED | Reviewed: Node 22.22 satisfies >=20.19; Vitest/Supertest; disposable PostgreSQL migration/health; 3 files/7 tests PASS at gate |
| W1-08 | Phase 2 | JobScheduler, Agenda 5 adapter/store isolation và registry | COMPLETED | Reviewed: registry-only concurrency/lock policy; partial unique stable-key index; 20-way concurrency/graceful-stop/auth-isolation/IANA tests PASS |
| W1-09 | Phase 2 | Side-effect isolation, observability và flag conventions | COMPLETED | Reviewed: Redis namespace container test; safe email/socket/notification modes; correlation/recursive-redaction/circular/flag-audit tests PASS |
| W1-10 | Phase 2 | Local/staging health, isolation và V1 regression gate | READY_FOR_REVIEW | All functional/isolation gates PASS; Supabase runtime/migration client sockets encrypted after option-A remediation; Agenda isolation/execution and full regression PASS |

### Wave 1 verification log

| Task | Command/check | Kết quả |
|---|---|---|
| W1-01 | `yarn verify:phase1:api` | PASS: legacy and `/api/v1` parity; V2 health enabled/disabled behavior; 55 V1 source operations retained |
| W1-01 | Targeted ESLint for `src/app.js`, `src/server.js`, environment and `src/api/**` | PASS, 0 issue |
| W1-01 | `git diff --check` | PASS; only expected Windows LF/CRLF warnings |
| W1-02 | `yarn verify:phase1:flags` | PASS: 6 V2 write flags default off; V1 authority, dependency, unknown/malformed config checks fail closed |
| W1-02 | Targeted ESLint + `src/v2` Express-object scan | PASS, 0 issue/import/reference |
| W1-03 | `yarn verify:phase1:contracts` + YAML parse | PASS: OpenAPI 3.1, 44 paths/55 operationIds, no duplicate operationId, 0 approved difference |
| W1-04 | `yarn verify:phase1` | PASS: build + API parity + flags + OpenAPI + boundary tests |
| W1-04 | `yarn lint` | PASS, 0 error/warning on current source |
| W1-05 | `docker compose ... --profile v2 config` | PASS; one extended Compose stack, existing Redis retained |
| W1-05 | `docker compose ... --profile v2 up -d --wait` + service probes | PASS: PostgreSQL accepting connections, Redis `PONG`, Agenda database `agenda_v2`; 3/3 containers healthy |
| W1-06 | `yarn prisma:validate` / generate / migrate deploy / seed | PASS on Prisma 7.9.1: schema valid, CommonJS client generated, 1 migration applied/idempotent, infrastructure-only seed |
| W1-06 | `yarn db:local:health` | PASS: Prisma 7 PostgreSQL adapter `SELECT 1`, latest 82ms observed |
| W1-06 | PostgreSQL catalog check | PASS: 1 completed Prisma migration, `pgcrypto` present, 0 Phase 2 business tables |
| W1-07 | `yarn test` at W1-07 gate | PASS: 3 files/7 tests; unit, Supertest contract and disposable PostgreSQL migration/health |
| W1-07 | Node/runtime check | PASS: Node 22.22.0 against declared `>=20.19.0`; `.nvmrc` baseline 20.19.0 |
| W1-08 | Unit + Agenda/MongoDB Testcontainers integration | PASS: 4 unit files/10 tests and 2 integration files/5 tests after scheduler scope; duplicate stable key produced 1 stored job; graceful stop idempotent |
| W1-08 | Agenda credential authorization test | PASS: dedicated `readWrite` credential dispatched in `agenda_v2_test` and was denied write to V1 business database |
| W1-08 | IANA timezone tests | PASS: Asia/Ho_Chi_Minh and America/New_York DST conversion/reschedule; invalid timezone rejected; no hard-coded +7 in V2 |
| W1-09 | Unit/contract/integration isolation tests | PASS: 6 unit files/17 tests, 1 contract file/2 tests, 3 integration files/6 tests |
| W1-09 | Redis Testcontainer namespace test | PASS: identical logical V1/V2 keys remained physically/value-isolated |
| W1-09 | Staging side-effect/observability tests | PASS: live production modes rejected; correlation header preserved/generated; secrets redacted; flag audit shape immutable |
| W1-10 | `yarn test:coverage` after Prisma 7/Yarn/Agenda routing decisions | PASS: 11 files/29 tests; statements 83.87%, branches 80.82%, functions 80.64%, lines 86.78% |
| W1-10 | V1 startup regression on disposable standalone MongoDB | PASS: DB connect, seed, Agenda start, legacy `/status` and `/api/v1/status` 200/equal; V2 default 404 |
| W1-10 | `yarn install --frozen-lockfile` + single-lock/install guard | PASS: Yarn 1.22.22 canonical; one `yarn.lock`; `package-lock.json` absent |
| W1-10 | PostgreSQL/Agenda environment contract simplification | PASS: explicit PostgreSQL names applied with legacy names 0; Agenda public config reduced to URI/database, code-owned collection/worker identity; pathless URI normalized; full suite 29/29 PASS |
| W1-10 | Final `yarn verify:phase1`, lint, build, Prisma validate | PASS: 55 V1 operations; Prisma generate + Babel 145 files; 14 `src/v2` files free of Express objects; ESLint 0 issue; Prisma schema valid |
| W1-10 | Final local Compose health | PASS: PostgreSQL/Redis/Agenda MongoDB 3/3 healthy and still running |
| W1-10 | Supabase staging connectivity recheck | PASS: pooled/session-migration connect, idempotent migration, seed and runtime health 568ms; 1 migration, 0 business tables |
| W1-10 | Supabase staging role isolation recheck | PASS: roles distinct; runtime schema/database/create-role/create-database/superuser all false; migration role retains schema/database CREATE |
| W1-10 | Agenda staging connectivity | PASS via in-memory DNS fallback: 3 SRV/1 TXT, TCP/TLS, authenticated ping; no secret/seed list persisted |
| W1-10 | Agenda staging authorization final recheck | PASS on fresh connection: 0 all-database write scopes; 6 Agenda-database write scopes; Agenda write allowed; business write denied; database names distinct |
| W1-10 | Agenda staging routing/execution/cleanup | PASS: pathless URI routing; real Atlas credential with Agenda 5-compatible driver; duplicate stable key produced 1 stored job and 1 handler execution; cleanup left 0 probes |
| W1-10 | Final post-staging `yarn test` | PASS: 11 files/29 tests after Supabase and Agenda gates closed |
| W1-10 | Final full Wave 1 re-audit | PASS: frozen install; build 145 files; lint 0; Phase 1 verification; Compose 3/3; local migrate/seed/health 95ms; 29/29 tests; unchanged coverage |
| W1-10 | Supabase transport-security audit | **FAIL/BLOCKING**: runtime and migration client sockets both unencrypted; `pg_stat_ssl=false`; current URLs do not request TLS |
| W1-10 | Supabase TLS remediation proof (in-memory only) | PASS candidate: `uselibpqcompat=true&sslmode=require` gives encrypted client sockets and idempotent Prisma migrate PASS; not persisted to `.env`, CA/hostname verification still not configured |
| W1-10 | Supabase TLS final persisted recheck | PASS: both URLs contain `uselibpqcompat=true&sslmode=require`; runtime/migration client sockets encrypted; roles distinct; Prisma validate/migrate/seed and health 681ms PASS |
| W1-10 | Non-production V2 gate owner decision and staging TLS template review | PASS: DEC-064 records non-production semantics; production remains fail-closed; both placeholder URLs use option-A TLS parameters and the pooled URL retains its query delimiter |
| W1-10 | Recursive structured-log redaction remediation | PASS: nested object/array authorization, cookie, password and token fields are redacted; circular references serialize safely; 6 unit files/20 tests and targeted lint PASS |
| W1-10 | Agenda stable-key concurrency remediation | PASS: code-owned partial unique `{ name, data.stableKey }` index is ensured before worker start; 20 concurrent schedules produced 1 stored job/1 handler execution; 4 integration files/9 tests and targeted lint PASS |
| W1-10 | Agenda registry-policy and duplicate-race remediation | PASS: `define(jobName, handler)` no longer accepts Agenda policy overrides; concurrency/lock lifetime come only from the reviewed registry; explicit E11000 recovery returns the existing stable-key job; focused unit 4/4 and targeted lint PASS |
| W1-10 | Post-review full local verification | PASS: 11 files/33 tests; statements 84.45%, branches 80.50%, functions 82.08%, lines 87.89%; Phase 1, full lint, Prisma validate/migrate/seed/health 82ms, package policy and Compose 3/3 PASS |
| W1-10 | Agenda staging stable-key index remediation | PASS: preflight found 0 duplicate stable-key groups; code-owned partial unique index present/unique; staging `v2_jobs` now has 3 indexes; no job or credential was logged |

### Phase 1 acceptance metrics

| Metric | Actual | Kết quả |
|---|---:|---|
| Legacy V1 source operations retained/mounted | 55/55 at legacy root and same router at `/api/v1` | PASS |
| Legacy smoke contract | `/status` and `/api/v1/status` identical status/body/headers | PASS |
| V2 foundation endpoints | 1 health operation; enabled and disabled mount cases tested | PASS |
| V2 deployment gate | Default disabled; `ENABLE_API_V2=true` still resolves false for `DEPLOYMENT_ENV=production`; other deployment labels are explicitly non-production by DEC-064 | PASS owner-approved/fail-closed in production |
| V2 write feature flags | 6/6 default disabled; authority/dependency checks enforced | PASS |
| V1 OpenAPI baseline | 44 paths, 55/55 unique operations; 0 approved differences | PASS skeleton |
| Source boundary | 14/14 current `src/v2` files free of Express objects; V2 controllers have 0 infrastructure import; legacy implementation diff empty | PASS |
| Build/lint | Prisma generate + Babel build 145 files; ESLint 0 issue | PASS |

Phase 1 đạt exit criteria và được nghiệm thu nội bộ ngày 2026-08-01 trước khi mở Phase 2. OpenAPI mới là baseline skeleton theo đúng scope Phase 1; schema chi tiết tiếp tục cần fixture/contract promotion ở các phase nghiệp vụ.

### Phase 2 acceptance metrics

| Metric | Actual | Kết quả |
|---|---:|---|
| Local Compose dependencies | PostgreSQL 16 + Redis 7 + Agenda MongoDB 7; 3/3 healthy | PASS |
| Clean PostgreSQL foundation | 1/1 infrastructure migration; seed PASS; 0 business tables | PASS |
| Package manager | Yarn 1.22.22; one canonical `yarn.lock`; frozen install/install guard PASS | PASS |
| Prisma local/API health | Prisma 7.9.1 + pg adapter `SELECT 1` PASS (latest 95ms observed); `/api/v2/health/postgres` integration PASS | PASS |
| Node/test stack | Node 22.22.0 (`>=20.19`), Vitest/Supertest/Testcontainers; 11 files/33 tests | PASS |
| Coverage evidence | statements 84.45%; branches 80.50%; functions 82.08%; lines 87.89% | PASS signal, no arbitrary threshold |
| Scheduler contract | 6/6 required methods implemented and exercised | PASS |
| Agenda stable-key/graceful shutdown | partial unique index; 20 concurrent schedules -> 1 stored job/1 execution; repeated stop safe | PASS |
| Agenda credential isolation | test credential writes Agenda DB and is denied on business DB | PASS disposable environment |
| IANA reminder time | UTC conversion/reschedule + DST/invalid-zone cases | PASS |
| Redis isolation | same logical key separated across V1/V2 namespaces | PASS |
| Email/Socket/notification staging modes | unsafe live modes rejected; sink/disabled/capture conventions tested | PASS config boundary |
| V1 regression | disposable MongoDB startup + legacy/versioned status parity | PASS |
| Supabase PostgreSQL staging | pooled/session-migration connect; roles distinct; both client sockets encrypted; migration/seed/health 681ms; 1 migration, 0 business tables | PASS option-A TLS |
| Actual Agenda staging credential/store | TCP/TLS/connect/ping PASS; 0 all-database write scopes; 6 Agenda DB write scopes; business DB write denied | PASS |
| Actual Agenda staging job/store | Agenda 5 adapter: duplicate stable key -> 1 stored job, handler execution 1, cleanup probes 0; preflight duplicate groups 0 and code-owned unique stable-key index present (3 total indexes) | PASS |

Phase 2 and Wave 1 meet the implementation/evidence exit gate and are `READY_FOR_REVIEW`. Project-owner review/sign-off is still required before `COMPLETED`. No business endpoint, business Prisma model, ledger or balance write was implemented.

Full Wave 1 file/evidence review: `docs/v2/migration/wave-1-review.md`.

W1-01 also replaces the non-portable `rm -rf build` command with an equivalent Node `fs.rmSync` build-clean script. This restores the existing V1 Babel build on Windows and does not change runtime behavior.

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

- `W1-STAGING-DB-001` (`RESOLVED` 2026-08-01): runtime/migration roles đã tách. Runtime role không có quyền tạo schema/database/role, không phải superuser; migration role vẫn có schema/database CREATE. Prisma validate, idempotent migrate deploy, infrastructure-only seed và runtime health 568ms đều PASS; 1 migration, 0 business tables. Transport TLS được theo dõi riêng bởi `W1-STAGING-TLS-001`.
- `W1-STAGING-AGENDA-001` (`RESOLVED` 2026-08-01): credential mới kết nối/ping PASS; server báo 0 all-database write scope, 6 Agenda-database write scopes và business-DB write denied. Agenda 5 adapter chạy real staging smoke job đúng 1 lần cho duplicate stable key, tạo 1 stored job và cleanup còn 0 probe. Native SRV resolver của máy vẫn `ECONNREFUSED`; verification dùng DNS fallback in-memory và MongoDB driver v4 đi kèm Agenda 5, không persist seed/credential. Đây là environment limitation đã có authenticated TLS/adapter evidence, không còn là credential/execution blocker.
- `W1-STAGING-TLS-001` (`RESOLVED` 2026-08-01): cả hai ignored `.env` URLs đã dùng `uselibpqcompat=true&sslmode=require`; runtime và migration client sockets đều `encrypted=true`. Roles vẫn tách, runtime không có schema/database/role/admin privilege; Prisma validate, idempotent migrate, seed và health 681ms PASS. Đây là option-A transport encryption, chưa xác minh CA/hostname như `verify-full`; migration credential vẫn có DDL/role/database-create capability và chỉ được dùng cho protected migration tooling.
- `W1-DEPENDENCY-AUDIT-001` (`OWNER_DEFERRED_NON_GATING` theo DEC-060): evidence audit lịch sử được giữ nguyên; không auto-fix, không tiếp tục xử lý và không dùng làm blocker/acceptance gate Wave 1.

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
- `OPEN-012` đã đóng bởi DEC-058: Yarn 1.22.22/`yarn.lock` canonical.
- `OPEN-013` đã đóng bởi DEC-059: Prisma 7.9.1 + pg adapter/CommonJS generator trong Wave 1.

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

Tại gate Wave 0 ban đầu chưa có automated test script; baseline lint failure khi đó không phát sinh từ Wave 0 docs/script và không được auto-fix. Wave 1 hiện đã bổ sung test foundation và có verification log riêng ở trên. Không có commit/push trong lượt triển khai này.

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
