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
| Wave 1 | Phase 1-2 - API và staging foundation | COMPLETED |
| Wave 2 | Phase 3 - PostgreSQL design freeze | COMPLETED |
| Wave 3 | Phase 4-4B - Financial kernel | IN_PROGRESS |
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
| Phase 2 | PostgreSQL staging foundation | COMPLETED |
| Phase 3 | PostgreSQL data model | COMPLETED |
| Phase 4 | Transaction core | IN_PROGRESS |
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

Wave 2 đã đạt toàn bộ exit criteria và chuyển `COMPLETED` ngày 2026-08-04 theo chỉ thị của project owner. Wave 3/Phase 4 đang `IN_PROGRESS`.

## Wave 2 task register

Task Wave 2 tuân thủ thứ tự bắt buộc. Task kế tiếp chỉ được mở sau khi output, evidence, verification và diff của task hiện tại đã được review.

| Task | Phase | Phạm vi | Trạng thái | Evidence/review |
|---|---|---|---|---|
| W2-00 | Entry gate | Wave 1 sign-off; Wave 0 inventory; local/staging PostgreSQL, Prisma và test infrastructure | COMPLETED | Owner sign-off 2026-08-02; Wave 0 10/10 tasks complete; Wave 1 latest full gate PASS (33 tests, Prisma/local/staging/Agenda evidence retained) |
| W2-01 | Phase 3A | Logical data model và aggregate ownership | COMPLETED | Reviewed `logical-data-model.md`: 26/26 source schemas represented; 19/19 required target entities present; no TBD/DRAFT; diff check PASS |
| W2-02 | Phase 3A | MongoDB–PostgreSQL mapping và load dependency graph | COMPLETED | Reviewed: 26/26 collections, 305/305 paths, exactly one action each (190 transform/29 migrate/85 archive/1 drop), no duplicate/unclassified path; load graph 26/26 |
| W2-03 | Phase 3A/3B | Authoritative physical table specification, roles, keys, constraints, indexes và delete policies | COMPLETED | Reviewed: 45/45 tables, 52 explicit enums, identity/money/rate/time/FK/delete/index/role/immutability policies; no floating money or unconstrained attachment key |
| W2-04 | Phase 3B2 | Financial invariant/posting templates và migration rules final approval | COMPLETED | Owner accepted all recommendations; DEC-065..070; 17/17 templates APPROVED, 26/26 migration rules approved, 0 TBD/DRAFT marker |
| W2-05 | Phase 3C | Prisma schema và versioned migrations | COMPLETED | Reviewed: Prisma 7 schema 45/45 models and 52/52 enums; clean local deploy 2/2 migrations; 105 FK, 65 CHECK, 39 triggers, 0 PUBLIC table grants; schema drift empty; append-only probe and build PASS |
| W2-06 | Phase 3C | System seed, `MIGRATION_EQUITY` và system accounts | COMPLETED | Reviewed idempotent seed: 8/8 system definitions, 18/18 physical definitions for 17 business templates, 43/43 entry roles, 0 non-APPROVED template; rerun PASS |
| W2-07 | Phase 3D | Staging-copy data profile/dry-run, reconciliation và reject classification | READY_FOR_REVIEW | W2-07A/B1/B2 accepted; actual owner-export load and reconciliation pass on clean Testcontainers. Owner point-in-time/staging attestation is retained as explicit deferred provenance evidence and does not misrepresent this owner-export run. |
| W2-07A | Phase 3D preparation | Read-only BSON export inventory, immutable fingerprinting and sanitized evidence boundary | COMPLETED | Independently accepted: owner-provided external export has 31 artifacts, 15 present + 11 explicitly absent routes and 763 records. Current hardened policy-v3 evidence is `d1b25339902b9d3f032d6b527e9a3a5ea306e9bd1b80fbb781f3ab7e8a9adc41`; zero detected secret/PII leak. No PostgreSQL load/reconciliation was performed. |
| W2-07B1 | Phase 3D transform | Pure classification, transform, posting plan and source-balance reconciliation | COMPLETED | Corrective cycle 5 independently accepted: two runs produced plan `054d208dc86819b67551841322ea80b906518d65a81b9ce934ffef7ff06b91fd`; 763 = 756 loaded + 7 archived + 0 rejected; 0 blocking/unclassified; 128 postings/256 entries; 6/6 balances exact; notifications/recipients 134/134 with valid read state. |
| W2-07B2 | Phase 3D load | Actual clean disposable-PostgreSQL load, reject retention and database-derived reconciliation | COMPLETED | Accepted on two runner-owned PostgreSQL 16 Testcontainers: target hash `e74f8804f6d243ad95b80f2c398fcfeab9e53caef406dc0263c6444eae00048c`; 763 = 756 loaded + 7 archived + 0 rejected; 26 checkpoints; all ledger/balance reconciliation exact; three legacy attachments retained `REQUIRES_REVIEW`. No Supabase/provider/production write. |
| W2-08 | Exit gate | Clean migration, schema validation, tests, evidence và Wave 2 review | READY_FOR_REVIEW | Final full-Wave gate PASS: lint/tests/V1/package/Prisma/schema/migration evidence/financial guards/export replay all pass; project-owner sign-off remains required; no Phase 4/Wave 3 start |
| W2-FIX-01 | Corrective | Atomic ledger chain và cached projection | COMPLETED | New versioned migration locks the account row, derives sequence/before/after, advances the cached projection atomically and rejects inactive/cross-space/negative postings; local migrate + seed + dry-run + reversal/projection guard PASS |
| W2-FIX-02 | Corrective | Template/type/detail/amount posting semantics | COMPLETED | Immutable template type/rule metadata and deferred semantic guard cover all 18 physical definitions; valid income accepted; wrong type, missing detail and header/entry amount mismatch rejected; seed rerun and Prisma validation PASS |
| W2-FIX-03 | Corrective | Audited `MIGRATION_EQUITY` anchor | COMPLETED | New migration makes discrepancy mandatory, enforces equity-role XOR and exact run/checksum/account/difference/resolved-case/approval evidence, and makes anchors immutable; valid rollback-only anchor accepted and missing-anchor posting rejected |
| W2-FIX-04 | Corrective | PostgreSQL credential boundary and least-privilege grants | COMPLETED | Seed/dry-run/schema/financial verification require direct migration credentials; provision/verification scripts derive identities from the two URLs and enforce the application matrix without role-name variables; job/readonly remain approved deferred profiles |
| W2-FIX-05 | Corrective | Database-derived dry-run target hash | COMPLETED | Dry-run now re-queries 17 canonical PostgreSQL target groups, hashes stable public/legacy identities and business/ledger fields, reconciles cached projection from database rows, and produces the same hash on two independent clean Testcontainers; integration 11/11 PASS |
| W2-FIX-06 | Corrective | Immutable sanitized migration evidence | COMPLETED | New migration adds database-derived sanitized hash, policy version, redaction manifest, state-consistency constraints, one-way terminal transitions and immutable update/delete guard; 22 local records verified with 0 hash mismatch/secret leak and all mutation probes rejected |
| W2-FIX-GATE | Local exit re-review | Clean migration, drift, deterministic local fixture, privileges, V1 regression and full tests after six fixes | COMPLETED | Local/database gates passed; this evidence does not replace the open Phase 3D staging-copy gate |
| W2-FIX-04A | Corrective review | Remove redundant PostgreSQL role-name configuration | COMPLETED | Four role-name variables removed; migration/application identities derived from authenticated `current_user`; equal-role URLs rejected; job/readonly grants deferred; focused integration 6/6 and full suite 36/36 PASS |

### Wave 2 verification log

| Task | Command/check | Kết quả |
|---|---|---|
| W2-00 | `yarn prisma:validate` | PASS: Prisma 7.9.1 foundation schema valid |
| W2-00 | `yarn test` after Docker Desktop restore | PASS: Docker 29.2.0; 11/11 files, 33/33 tests including disposable PostgreSQL/MongoDB/Redis |
| W2-01 | Complete source/document read | PASS: 26/26 `src/models` schemas, constants, Wave 0 inventories and V2 transaction/auth/job/asset/discrepancy contracts reviewed |
| W2-01 | Logical entity/marker check + `git diff --check` | PASS: 19/19 required target entities; 0 TBD/DRAFT; whitespace clean (Windows line-ending notices only) |
| W2-02 | Field mapping parser/reconciliation | PASS: 305/305 unique source paths across 26/26 collections; exactly one allowed action per path; `_id` disposition 26/26 |
| W2-02 | Action distribution | PASS: 190 `TRANSFORM`, 29 `MIGRATE`, 85 `ARCHIVE`, 1 security `DROP` (`users.verifyToken`) |
| W2-02 | Dependency graph review + `git diff --check` | PASS: L0-L20 order, cycles/deferred refs, reject routes and checkpoints explicit; 26/26 source collections routed |
| W2-03 | Cross-document physical schema check | PASS: 45/45 table specs and 19/19 required schema invariant terms found; 52 enums explicit |
| W2-03 | Money/ownership safety scan | PASS: 0 floating PostgreSQL types; 0 unconstrained attachment resource keys; explicit ledger-account/attachment FKs |
| W2-03 | FK/delete/index/role review + `git diff --check` | PASS: consolidated FK policy; RESTRICT/soft-delete for history; migration/application/job/readonly grants defined |
| W2-04 | Project-owner business decisions | PASS: OPEN-006..011 resolved by DEC-065..070; transfer fee, debt, zero, family, saving-interest and cross-space semantics fixed |
| W2-04 | Posting/migration catalog parser | PASS: 17/17 template rows `APPROVED`; 0 TBD/DRAFT; 26/26 migration rules `APPROVED`/`APPROVED_ARCHIVE` |
| W2-04 | Cross-space physical re-review | PASS: contribution uses `interspace_transfer_groups`, `CONTRIBUTION_OUT/IN` and `INTERSPACE_CLEARING`; transfer stays same-space |
| W2-05 | `yarn prisma:validate`, `yarn prisma:generate`, `yarn build` | PASS: Prisma 7.9.1 valid/generated; 190 source files compiled; no V1 source behavior changed |
| W2-05 | Clean local `prisma migrate deploy` + `prisma migrate status` | PASS: empty database received foundation + Wave 2 migration; database schema up to date |
| W2-05 | `yarn db:verify:wave2-schema` | PASS: 45 tables, 52 enums, 105 FK, 65 CHECK, 39 triggers, 0 PUBLIC grants; append-only guard rejected mutation |
| W2-05 | Live schema -> Prisma drift check | PASS: Prisma 7 `migrate diff --from-config-datasource --to-schema ... --exit-code` returned empty migration |
| W2-06 | `yarn prisma:seed` twice against clean local database | PASS: both runs returned 8 system definitions, 18 physical templates, 43 entry roles and 17 business templates; no duplicate/change |
| W2-06 | Seed registry query | PASS: 8 exact codes including one active `MIGRATION_EQUITY`; 18 distinct hashes; 0 template outside `APPROVED` |
| W2-07 | `node --check scripts/run-wave2-controlled-dry-run.cjs` | PASS |
| W2-07 | Two independent clean `yarn db:dry-run:wave2` runs | PASS: source checksum and canonical target hash identical; 26/26 routes, 0 rejects/unclassified/blocking |
| W2-07 | PostgreSQL reconciliation queries | PASS: run COMPLETED; 22 source = 16 loaded + 6 archived; 26/26 checkpoints; 5 transactions/10 entries; 0 unbalanced; 0 active BLOCKING |
| W2-07A | External BSON inventory and sanitizer verification | PASS: raw export remained at `D:\Sghb\mongodb-heymoney-data\Heymoney-Data` and was not copied/committed; 31 artifacts, 26 routes, 763 records; raw inventory `767216c179b5b10a27e99e7594ec0d8c6a982a5e52ae7863d3202100df197b8c`; semantic snapshot `a7bbcdf03dc93eef67597e4c503efaa2b0a4fb91fc62f10b7dd727f0f01a0769`; current policy-v3 sanitized evidence `d1b25339902b9d3f032d6b527e9a3a5ea306e9bd1b80fbb781f3ab7e8a9adc41` |
| W2-07B1 | Transform plan, source reconciliation and independent review | PASS: two independent runs identical; 763 = 756 loaded + 7 archived + 0 rejected; 0 blocking/unclassified; 128 postings/256 entries; 6/6 balances at zero mismatch; 134/134 notification recipients satisfy read-state contract; plan `054d208dc86819b67551841322ea80b906518d65a81b9ce934ffef7ff06b91fd` |
| W2-07B1 | Focused/full verification | PASS: focused 67/67, full unit 89/89 and full suite 104/104; targeted/full lint, syntax and diff checks PASS; corrective cycle 5 outcome `ACCEPT` |
| W2-07B2 | `node scripts/run-wave2-export-disposable-load.cjs --testcontainer` on two clean PostgreSQL 16 containers | PASS: migrations twice + seed twice; evidence-recomputing replay; source/evidence/transform/identity hashes retained; identical target hash `e74f8804f6d243ad95b80f2c398fcfeab9e53caef406dc0263c6444eae00048c` |
| W2-07B2 | Database load and reconciliation | PASS: 763 = 756 loaded + 7 archived + 0 rejected; 26/26 checkpoints; 3 users/spaces/owner memberships; 21 banks; 207 categories/138 edges; 4 accounts; 2 accumulations; 2 contacts; 30 ledgers; 128 postings/256 entries; 124 source transactions; 1 budget; notifications/recipients 134/134; 3 `LEGACY_EXTERNAL` `REQUIRES_REVIEW` attachments; unbalanced/projection/balance mismatch 0 at tolerance 0 VND |
| W2-08 | Final full-Wave acceptance gate | PASS: `yarn lint`; `yarn test` 17 files/124 tests; `yarn verify:package-manager`; `yarn verify:phase1`; Prisma validate; schema verification 45 tables/4 views/52 enums/105 FK/70 CHECK/108 triggers; controlled migration evidence and financial guards; Docker export load/replay target `e74f8804f6d243ad95b80f2c398fcfeab9e53caef406dc0263c6444eae00048c`; V1 changed paths 0; no Supabase/provider/production write |
| W2-08 | Full reversal database guard | PASS: exact sign-opposite accepted; balanced but 1 VND non-opposite rejected; both probes rolled back |
| W2-08 | `yarn verify:package-manager`, `yarn verify:phase1`, `yarn lint` | PASS: Yarn canonical; 55-operation V1 parity/API boundaries; zero lint issue |
| W2-08 | `yarn test` outside Docker-restricted sandbox | PASS: 11/11 files, 33/33 tests including PostgreSQL/MongoDB/Redis Testcontainers and V1 startup |
| W2-08 | `yarn test:coverage` | PASS: statements 84.45%, branches 80.50%, functions 82.08%, lines 87.89% |
| W2-08 | Final Prisma validate/drift/schema/script/diff audit | PASS: schema valid, drift empty, 45/52/105/65/39/0 metrics, scripts parse, whitespace clean |
| W2-FIX-01 | Local corrective migration + controlled seed/dry-run + financial guard | PASS: migration 3/3 applied; dry-run 22 records and 3/3 balances exact; ledger projection query 0 mismatch; exact reversal accepted and invalid reversal rejected with all probes rolled back |
| W2-FIX-02 | Posting semantic migration + seed + negative database probes | PASS: 18/18 definitions mapped to immutable transaction type/rule; valid posting accepted; type mismatch, missing detail and amount mismatch rejected; Prisma schema valid |
| W2-FIX-03 | Audited migration-anchor migration + database probes | PASS: valid evidence-bound anchor accepted inside rollback; `MIGRATION_EQUITY` without anchor rejected; anchor discrepancy is NOT NULL and anchor rows reject update/delete |
| W2-FIX-04 | Clean Testcontainer migration + application role provisioning | PASS at original gate; superseded by W2-FIX-04A identity-discovery rerun |
| W2-FIX-05 | Two independent clean Testcontainer migrate/seed/dry-run executions | PASS: identical source checksum and database-derived target hash; 17 canonical target groups; 0 unbalanced transaction, projection mismatch or balance mismatch |

## Wave 3 task register

Task Wave 3 tuân thủ thứ tự bắt buộc từ execution-waves.md §6. Task kế tiếp chỉ được mở sau khi output, evidence, verification và diff của task hiện tại đã được review.

| Task | Phase | Phạm vi | Trạng thái | Evidence/review |
|---|---|---|---|---|
| W3-00 | Entry gate | Wave 2 sign-off; Prisma migrations; posting templates; documentation baseline | COMPLETED | Wave 2 COMPLETED by owner directive 2026-08-04; 17/17 templates APPROVED; 8 migrations clean; all unit tests PASS (137) |
| W3-01 | Phase 4 | TransactionContext + Database Boundary | COMPLETED | Created `TransactionContext` + `TransactionManager`; 14/14 tests PASS; enforced assertTransactionContext guard in all financial repositories |
| W3-02 | Phase 4 | Idempotency Protocol | COMPLETED | Created `IdempotencyService` + `IdempotencyRepository`; 6/6 tests PASS; protocol: same-key/same-hash→OK, same-key/diff-hash→409, IN_PROGRESS→409, FAILED_FINAL→409 |
| W3-03 | Phase 4 | Ledger Repository + Cached Balance | COMPLETED | Created `LedgerRepository`; ordered lock (FOR UPDATE), entry creation with balance update, posting sum=0 validation, link to transaction |
| W3-04 | Phase 4 | Financial Transaction Core | COMPLETED | Created `FinancialTransactionService`; orchestrates posting via ledger + idempotency; amount>0 enforcement (DEC-067) |
| W3-05 | Phase 4 | Full Reversal | COMPLETED | Created `ReversalService`; exact opposite postings, one-reversal-only guard, original status→REVERSED |
| W3-06 | Phase 4 | Outbox Writer | COMPLETED | Created `OutboxRepository`; in-transaction event creation, FOR UPDATE SKIP LOCKED claim, lease/retry |
| W3-07 | Phase 4 | Discrepancy/Reconciliation Writer | COMPLETED | Created `ReconciliationService`; ledger-sum vs cached-balance check, discrepancy case creation |
| W3-08 | Phase 4B | Periodic Balance Snapshot Core | COMPLETED | Created `SnapshotCalculator` (pure), `SnapshotRepository`, `SnapshotGenerator`; idempotent generation, carry-forward, checksum, catch-up; 10/10 calculator tests PASS |

### Wave 3 verification log

| Task | Command/check | Kết quả |
|---|---|---|
| W3-01 | `npx vitest run tests/unit/financial/TransactionContext.test.js` | PASS: 14/14 |
| W3-02 | `npx vitest run tests/unit/financial/idempotency.service.test.js` | PASS: 6/6 |
| W3-08 | `npx vitest run tests/unit/financial/snapshotCalculator.test.js` | PASS: 10/10 |
| W3-ALL | `npx vitest run tests/unit` | PASS: 14 files, 137/137 tests |
| W3-ALL | Module dynamic import check | TransactionContext OK (function), snapshotCalculator OK (object) |

### Files created (Wave 3)

```
src/v2/modules/financial/
├── core/
│   ├── TransactionContext.js
│   ├── TransactionManager.js
│   ├── idempotency.service.js
│   ├── idempotency.repository.js
│   ├── ledger.repository.js
│   ├── financialTransaction.service.js
│   ├── reversal.service.js
│   ├── outbox.repository.js
│   ├── reconciliation.service.js
│   └── index.js
└── snapshot/
    ├── snapshotCalculator.js
    ├── snapshotRepository.js
    ├── snapshotGenerator.js
    └── index.js

tests/unit/financial/
├── TransactionContext.test.js
├── idempotency.service.test.js
└── snapshotCalculator.test.js
```

| W2-FIX-06 | Local immutable-evidence migration + verifier | PASS: 22/22 records have matching database-derived sanitized hash; password redaction manifest present; 0 secret leak; raw update, delete and terminal reclassification rejected with probes rolled back |
| W2-FIX-GATE | Final aggregate verification | PASS: package manager, build, Phase 1 55-operation parity, lint, Prisma validate/generate/status/drift, schema/financial/evidence guards, current 11/11 files and 37/37 tests, coverage baseline 84.45/80.50/82.08/87.89 |
| W2-FIX-04A | Configuration/search, CLI and regression review | PASS: 0 role-name configuration references; no job/readonly credential variable; URL identities discovered as distinct, equal-role case rejected, privilege CLI PASS, focused 6/6 and full 36/36 tests, lint PASS |

W2-01 output: `docs/v2/database/logical-data-model.md`. Review chốt normalized ownership qua `FinancialSpace`, aggregate boundaries và các invariant logic; OPEN-006..011 được containment rõ ràng và vẫn là gate của W2-04. Không có database hoặc source runtime nào bị thay đổi.

W2-02 outputs: `docs/v2/database/mongodb-postgresql-mapping.md`, `docs/v2/migration/load-dependency-graph.md`, updated `migration-rule-catalog.md`. Mapping uses logical targets only; physical names/types/constraints remain exclusively owned by W2-03. No source field is silently omitted.

W2-03 outputs: `postgresql-data-model.md`, `postgresql-table-specification.md`, `ledger-schema.md`, `auth-session-schema.md`, `outbox-idempotency-schema.md`, `asset-attachment-schema.md`, `discrepancy-audit-schema.md`. Prisma remains unchanged until W2-04 closes the posting/business-decision gate.

W2-04 outputs: updated `decision-register.md`, approved `financial-invariant-matrix.md`, approved `migration-rule-catalog.md`, new `legacy-financial-posting-rules.md` and re-reviewed physical cross-space specification. The prior blocker is resolved; no business endpoint or Phase 4 transaction core was implemented.

W2-05 outputs: `prisma/schema.prisma`, `prisma/migrations/20260802091444_wave2_physical_schema/migration.sql`, `scripts/verify-wave2-schema.cjs` and package command `db:verify:wave2-schema`. Prisma was introspected from the clean migrated database so all 105 FK relations remain represented; unsupported checks, partial indexes, deferrable constraints, triggers and privilege revocations remain authoritative raw SQL. Review found and corrected the W2-03 enum metric from 51 to 52. No production database was touched.

W2-06 output: `prisma/seed.ts` now owns only immutable system metadata. It creates eight system-account definitions and 18 version-1 approved physical posting definitions (43 role rows) for the 17 approved business templates. It does not create users, financial spaces, ledger balances or transactions. Existing mismatched hashes/policies fail the seed instead of being overwritten.

W2-07 supporting outputs: `scripts/run-wave2-controlled-dry-run.cjs`, `scripts/run-wave2-export-disposable-load.cjs`, `reconciliation-specification.md` and `wave-2-dry-run-report.md`. The controlled fixture validates all 26 routes and deterministic database behavior, but it is not a staging-copy run. W2-07A accepted the read-only inventory and policy-v3 sanitization boundary for the owner-provided BSON export at `D:\Sghb\mongodb-heymoney-data\Heymoney-Data`; W2-07B1 accepted its pure transform/reconciliation plan; W2-07B2 accepted the actual clean Testcontainer load and database-derived reconciliation. Raw data remains external and was neither copied nor committed. W2-07 is `READY_FOR_REVIEW`. The supplied BSON does not independently attest source environment or point-in-time/staging provenance; owner attestation remains explicit deferred evidence, not an inferred property of this run. No production connection or external side effect was used.

W2-08 output: `docs/v2/migration/wave-2-review.md`. Database guard issues are covered by the current hardening migration and disposable-PostgreSQL probes. The final full-Wave acceptance gate passed; Wave 2/Phase 3 is `READY_FOR_REVIEW`, not `COMPLETED`, pending project-owner sign-off. Owner source-environment/point-in-time attestation remains explicit deferred provenance evidence. Wave 3 remains `NOT_STARTED`.

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
| W1-10 | Phase 2 | Local/staging health, isolation và V1 regression gate | COMPLETED | Owner accepted 2026-08-02 after all functional/isolation gates PASS; Supabase runtime/migration client sockets encrypted; Agenda isolation/execution and full regression PASS |

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

Phase 2 and Wave 1 met the implementation/evidence exit gate and were project-owner signed off `COMPLETED` on 2026-08-02. No business endpoint, business Prisma model, ledger or balance write was implemented in Wave 1.

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
