# Wave 2 Review — PostgreSQL Design Freeze

Ngày review: 2026-08-02. Kết luận: **READY_FOR_REVIEW**, chờ project-owner sign-off để chuyển `COMPLETED`. Wave 3/Phase 4 chưa được mở.

## 1. Scope and entry gate

- Wave 0 và Wave 1 đã `COMPLETED`; local/Supabase PostgreSQL, Prisma 7.9.1, Yarn, Vitest/Testcontainers và Agenda isolation evidence đã PASS trước khi mở Wave 2.
- Đã đọc lại toàn bộ decision register và các tài liệu được chỉ định: `execution-waves.md`, `master-plan.md`, `design-rules.md`, `interest-rate-rules.md`, `data-migration-strategy.md`, `final-migration-strategy.md`, `financial-invariant-matrix.md`, `progress.md` cùng Wave 0 inventory/source evidence liên quan.
- Thực hiện tuần tự W2-01 -> W2-08. Không triển khai business endpoint, transaction service/core, balance writer hoặc Phase 4.
- Không ghi production MongoDB/PostgreSQL, không gọi provider side effect, không commit/push.

## 2. Deliverables reviewed

### Logical, mapping and physical design

- `docs/v2/database/logical-data-model.md`
- `docs/v2/database/mongodb-postgresql-mapping.md`
- `docs/v2/migration/load-dependency-graph.md`
- `docs/v2/database/postgresql-data-model.md`
- `docs/v2/database/postgresql-table-specification.md`
- `docs/v2/database/auth-session-schema.md`
- `docs/v2/database/ledger-schema.md`
- `docs/v2/database/outbox-idempotency-schema.md`
- `docs/v2/database/asset-attachment-schema.md`
- `docs/v2/database/discrepancy-audit-schema.md`

### Rules, migration and evidence

- Updated `decision-register.md`, `financial-invariant-matrix.md`, `migration-rule-catalog.md` and `data-quality-report.md`.
- Added `legacy-financial-posting-rules.md`, `reconciliation-specification.md` and `wave-2-dry-run-report.md`.
- Added `prisma/schema.prisma`, versioned migration `20260802091444_wave2_physical_schema`, idempotent `prisma/seed.ts` and three verification/dry-run scripts.
- Updated `tests/integration/postgresFoundation.test.js` from the obsolete Phase 2 expectation to the reviewed Wave 2 schema metrics.

## 3. Acceptance metrics

| Gate | Actual | Result |
|---|---:|---|
| MongoDB collection rules | 26/26 | PASS |
| Source field/path dispositions | 305/305; 190 transform, 29 migrate, 85 archive, 1 security drop | PASS |
| Logical required entities | 19/19 | PASS |
| PostgreSQL tables / enums | 45 / 52 | PASS |
| Foreign keys / CHECK constraints / triggers | 105 / 65 / 39 | PASS |
| PUBLIC table grants | 0 | PASS |
| Business posting templates | 17/17 APPROVED | PASS |
| Physical template definitions | 18/18 APPROVED, 18 distinct hashes | PASS |
| System definitions / entry roles | 8 / 43 | PASS |
| TBD/DRAFT posting rows in cutover matrix | 0 | PASS |
| Clean migrations | 2/2 applied from empty database | PASS |
| Prisma live-schema drift | empty migration | PASS |
| Controlled source routes | 26/26 | PASS |
| Dry-run records | 22 = 16 loaded + 6 archive-only + 0 rejected | PASS |
| Dry-run data errors | 0 unclassified, 0 active BLOCKING | PASS |
| Ledger result | 5 transactions, 10 entries, 0 unbalanced | PASS |
| Balance reconciliation | 3/3 match, total/max difference 0 VND | PASS |
| Deterministic clean rerun | identical source checksum and target hash | PASS |
| Full reversal guard | exact opposite accepted; 1 VND mismatch rejected; probes rolled back | PASS |
| V1/API regression | 55 V1 operations; legacy and `/api/v1` parity; V2 health gate PASS | PASS |
| Full test suite | 11/11 files, 33/33 tests | PASS |
| Coverage | statements 84.45%, branches 80.50%, functions 82.08%, lines 87.89% | PASS/supporting |

## 4. Commands and evidence

```text
yarn prisma:validate
yarn prisma:generate
yarn prisma:migrate:deploy
yarn prisma:seed
yarn db:verify:wave2-schema
yarn db:dry-run:wave2
yarn db:verify:wave2-financial-guards
yarn verify:package-manager
yarn verify:phase1
yarn lint
yarn test
yarn test:coverage
prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --exit-code
git diff --check
```

All final commands PASS. The first sandboxed `yarn test` attempt could not access Docker; the authorized Testcontainers rerun executed all 33 tests and passed. `git diff --check` emits Windows LF/CRLF notices only.

## 5. Data-quality and dry-run conclusion

- Controlled fixture has no missing required field, orphan, duplicate, invalid/unsafe money or balance mismatch.
- No saving record exists in the fixture or Wave 0 profiled source; invalid-rate count is therefore 0 over 0 records. The rule remains blocking for any future invalid/ambiguous saving rate and no interest is inferred.
- Six rows are explicitly routed to archive-only lanes; nothing is silently skipped.
- No migration anchor was created. `MIGRATION_EQUITY` exists as an active definition only and requires audited discrepancy/evidence/approval.
- Source checksum: `7695a5af5504c4c684d81bcfb4bb3cfa88e7cfee4556d10f0fc5b277609dd074`.
- Target hash: `591684e02e2b2c74e0382c740f6402b6728209d5368a0131b167ea9d506d176e`.

## 6. Blockers and retained decisions

There is no unresolved blocker inside Wave 2 exit criteria. `OPEN-005` (production PostgreSQL hosting/connection/RPO/RTO) remains intentionally open for Phase 10B and does not block the Phase 3 design freeze.

Retained later gates are not Wave 2 defects: final cutover requires an immutable production snapshot and at least three rehearsals; full financial command implementation/tests belong to Wave 3; Supabase staging was not mutated by this local controlled dry-run.

Prisma reports expected warnings for CHECK constraints and deferrable FKs it cannot fully express. Raw versioned migration is authoritative for those constraints, partial indexes, triggers and grants; live database -> Prisma diff is empty after introspection.

## 7. Final assessment

All Wave 2/Phase 3 exit criteria are evidenced. Status is **READY_FOR_REVIEW**, not `COMPLETED`, until project-owner sign-off. Do not start Wave 3 automatically.
