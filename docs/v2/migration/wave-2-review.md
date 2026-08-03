# Wave 2 Review — PostgreSQL Design Freeze

Ngày review: 2026-08-02. Kết luận đã hiệu chỉnh: **IN_PROGRESS**. Local fixture validation passes, but the required Phase 3D staging-copy transform/load/reconciliation evidence is not present. Wave 3/Phase 4 chưa được mở.

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
- Added `prisma/schema.prisma`, eight versioned migrations through `20260802125000_wave2_contract_hardening`, idempotent `prisma/seed.ts`, least-privilege role policy/provisioning and the verification/dry-run scripts. The final hardening migration adds signed-opening, full debt settlement, typed-fact, ownership, durable state-machine, identity and UTC-boundary guards.
- Updated `tests/integration/postgresFoundation.test.js` from the obsolete Phase 2 expectation to the reviewed Wave 2 schema metrics.

## 3. Acceptance metrics

| Gate | Actual | Result |
|---|---:|---|
| MongoDB collection rules | 26/26 | PASS |
| Source field/path dispositions | 305/305; 190 transform, 29 migrate, 85 archive, 1 security drop | PASS |
| Logical required entities | 19/19 | PASS |
| PostgreSQL tables / enums | 45 / 52 | PASS |
| Foreign keys / CHECK constraints / trigger events | 105 / 70 / 108 | PASS |
| Payload-safe readonly views | 4 | PASS |
| PUBLIC table grants | 0 | PASS |
| Business posting templates | 17/17 APPROVED | PASS |
| Physical template definitions | 18/18 APPROVED, 18 distinct hashes | PASS |
| System definitions / entry roles | 8 / 43 | PASS |
| TBD/DRAFT posting rows in cutover matrix | 0 | PASS |
| Clean migrations | 8/8 applied from empty database | PASS |
| Prisma live-schema drift | empty migration | PASS |
| Controlled local-fixture source routes | 26/26 | PASS (supporting only) |
| Local-fixture records | 22 = 16 loaded + 6 archive-only + 0 rejected | PASS (supporting only) |
| Local-fixture data errors | 0 unclassified, 0 active BLOCKING | PASS (supporting only) |
| Ledger result | 5 transactions, 10 entries, 0 unbalanced | PASS |
| Balance reconciliation | 3/3 match, total/max difference 0 VND | PASS |
| Deterministic local clean rerun | identical source checksum and database-derived hash over 17 groups / 89 rows | PASS (supporting only) |
| Required staging-copy Phase 3D run | No staging snapshot/export manifest or staging-shaped load evidence | MISSING / GATING |
| Financial database guards | atomic projection; type/detail/amount; exact reversal; audited anchor probes PASS | PASS |
| Sanitized migration evidence | 22/22 hash match; 0 secret leak; update/delete/reclassification rejected | PASS |
| Database credential boundary | migration/application identities derived from authenticated URLs; distinct-role fail-closed guard; application positive/negative privileges on disposable PostgreSQL | PASS |
| V1/API regression | 55 V1 operations; legacy and `/api/v1` parity; V2 health gate PASS | PASS |
| Full test suite | 11/11 files, 37/37 tests | PASS |
| Coverage | statements 84.45%, branches 80.50%, functions 82.08%, lines 87.89% | PASS/supporting |

## 4. Commands and evidence

```text
yarn prisma:validate
yarn prisma:generate
yarn prisma:migrate:deploy
yarn prisma:seed
yarn db:verify:wave2-schema
yarn db:dry-run:wave2
yarn db:verify:wave2-financial-guards:disposable # harness-only; requires a matching verifier-owned marker token
yarn db:verify:wave2-migration-evidence
yarn db:provision:wave2-roles
yarn db:verify:wave2-privileges
yarn verify:package-manager
yarn verify:phase1
yarn lint
yarn test
yarn test:coverage
prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --exit-code
git diff --check
```

All final local/disposable commands PASS. The authorized Testcontainers rerun executed all 37 tests and passed. `git diff --check` emits Windows LF/CRLF notices only. Role provisioning was executed and verified with disposable credentials through the integration harness; it never creates roles or mutates Supabase automatically. Migration/application identifiers are derived from authenticated `current_user`, so no parallel role-name configuration is required.

The financial guard verifier is destructive test infrastructure, not an operator command for an existing environment. Before its first write it requires a random `WAVE2_DISPOSABLE_DATABASE_TOKEN` whose marker row is bound to `current_database()`, `current_user`, the `WAVE2_FINANCIAL_GUARDS` purpose and a future expiry. The integration harness creates that marker only in a dedicated second Testcontainers database, runs committed concurrency probes there, and destroys the database afterward. An unmarked database is rejected before any probe write; single-session cross-aggregate probes run under an outer rollback with savepoint-based negative assertions.

## 5. Data-quality and dry-run conclusion

- Controlled fixture has no missing required field, orphan, duplicate, invalid/unsafe money or balance mismatch.
- No saving record exists in the fixture or Wave 0 profiled source; invalid-rate count is therefore 0 over 0 records. The rule remains blocking for any future invalid/ambiguous saving rate and no interest is inferred.
- Six rows are explicitly routed to archive-only lanes; nothing is silently skipped.
- No migration anchor was created. `MIGRATION_EQUITY` exists as an active definition only and requires audited discrepancy/evidence/approval.
- Source checksum: `7695a5af5504c4c684d81bcfb4bb3cfa88e7cfee4556d10f0fc5b277609dd074`.
- Target hash: `9c743816ebd15e71aa57dc76fe6eb3198b2ec49709b7bb904e4f6a0fa43417eb` over 17 canonical PostgreSQL groups / 89 persisted rows.
- Sanitized source evidence: 22/22 hashes match, zero secret leak, immutable update/delete/terminal-transition probes rejected.

## 6. Blockers and retained decisions

`W2-STAGING-COPY-001` is unresolved and gates Wave 2 exit: run the approved transform/load against an authorized read-only staging copy and retain the source manifest, classified rejects, load checkpoints and reconciliation checksums. `OPEN-005` remains intentionally open for Phase 10B.

Final cutover still requires an immutable production snapshot and at least three rehearsals; full financial command implementation/tests belong to Wave 3. The fact that Supabase staging was not mutated is safe, but the absence of a read-only staging-copy input means Phase 3D is not complete.

Before the next controlled Supabase schema deployment, operators run `yarn db:provision:wave2-roles` and `yarn db:verify:wave2-privileges` with the existing `POSTGRESQL_DIRECT_URL` and `POSTGRESQL_DATABASE_URL`. Both commands authenticate the URLs, derive their actual `current_user` identities and fail if the roles are equal. Job/readonly profiles remain in the physical specification and receive dedicated URL credentials plus grants only when those PostgreSQL consumers are introduced; Agenda currently uses its isolated MongoDB store.

Prisma reports expected warnings for CHECK constraints and deferrable FKs it cannot fully express. Raw versioned migration is authoritative for those constraints, partial indexes, triggers and grants; live database -> Prisma diff is empty after introspection.

## 7. Final assessment

Wave 2/Phase 3 is **IN_PROGRESS** pending `W2-STAGING-COPY-001`. The local fixture is useful supporting evidence but cannot satisfy Phase 3D. Do not start Wave 3 automatically.
