# Wave 1 Review — API and Staging Foundation

Review date: 2026-08-01. Scope: Phase 1 and Phase 2 only. Current result after full re-audit, TLS and code-review remediation: **READY_FOR_REVIEW, not yet COMPLETED**. Functional/local/role/Agenda gates pass and both Supabase client connections now use encrypted transport; project-owner sign-off remains.

## Entry gate and documents read

- Wave 0/Phase 0 was project-owner signed off, marked `COMPLETED`, and rechecked at 10/10 completed tasks before source edits.
- Fully read: `execution-waves.md`, `master-plan.md`, `progress.md`, the entire `decision-register.md`, `architecture/overview.md`, `api-security-contracts.md`, `job-scheduler.md`, `testing/strategy.md`, plus directly required `production-readiness.md`, `implementation-guardrails.md` and repository `CLAUDE.md`.
- Preserved the existing Wave 0 commit/worktree; no commit or push was made in Wave 1.

## Delivered scope

### Phase 1 — completed

- Existing router is re-exported from `src/api/v1` and mounted unchanged at legacy root and `/api/v1`.
- `src/api/v2` owns route/controller/Joi/API mapper/middleware for health; `src/v2` owns framework-neutral service/infrastructure.
- `/api/v2/health` is environment-gated and production fail-closed.
- Feature registry has 6 write flags default off and enforces dependencies/write authority.
- OpenAPI V1 skeleton covers 44 paths/55 operations; approved-difference registry has 0 approved differences.
- Cross-platform Node build cleanup replaced the Windows-incompatible `rm -rf` command.

### Phase 2 — implementation/local verification complete

- Existing Compose file retains Redis and adds PostgreSQL 16 plus dedicated Agenda MongoDB 7 profile/service.
- Prisma 7.9.1, the PostgreSQL driver adapter, infrastructure-only migration/seed and PostgreSQL health API are present; no business model/table exists. The generated client is CommonJS-compatible TypeScript compiled by Babel, so V1 remains CommonJS.
- Node `>=20.19`, `.nvmrc` 20.19.0, Vitest 4, V8 coverage, Supertest 7 and Testcontainers 12 are configured.
- Yarn 1.22.22 and `yarn.lock` are canonical; npm install is rejected, `package-lock.json` is ignored/absent and frozen install is verified.
- `JobScheduler`, Agenda 5 adapter, job registry, non-financial smoke job, registry-only concurrency/lock policy, MongoDB-enforced stable keys, graceful shutdown and IANA reminder conversion exist.
- Redis namespace, staging side-effect modes, correlation IDs, recursively redacted/circular-safe structured logs and feature-flag audit shape are tested.

## Files changed/created

- Runtime/config: `.env.example`, `.env.staging.example`, `.nvmrc`, `.babelrc`, `.gitignore`, `docker-compose.dev.yml`, `package.json`, `yarn.lock`, `prisma.config.ts`, `vitest.config.mjs`, `src/app.js`, `src/server.js`, `src/config/environment.js`.
- API: `src/api/v1/index.js` and all files under `src/api/v2/{routes,controllers,validations,mappers,middlewares}`.
- Framework-neutral V2: `src/v2/infrastructure/{cache,config,database,feature-flags,jobs,observability}` and `src/v2/modules/system/services/getPostgresHealth.service.js`.
- Database: `prisma/schema.prisma`, infrastructure migration/lock and `prisma/seed.ts`; generated Prisma client is build output and ignored.
- Tests/scripts: all files under `tests/` and `scripts/`.
- Contracts/operations: `docs/v2/api/*`, `docs/v2/operations/{staging-foundation,job-registry,observability-baseline}.md`, this review and `progress.md`.
- No file under legacy `src/routes`, `controllers`, `services`, `models`, `validations`, `middlewares` or `agenda` was modified.

## Acceptance evidence

| Gate | Actual result |
|---|---|
| V1/API parity | 55/55 V1 operations; legacy and `/api/v1` status equal; production V2 mount fail-closed |
| V1 startup | Disposable standalone MongoDB startup, seed, Agenda and both V1 status URLs PASS |
| Package manager | Yarn 1.22.22; one `yarn.lock`; frozen install and install guard PASS; no `package-lock.json` |
| Build/lint/boundary | Prisma generate + Babel 145 files; ESLint 0; 14 current `src/v2` files have no Express object; controller infrastructure scan clean |
| Local health | PostgreSQL, Redis and Agenda MongoDB 3/3 healthy; Compose services left running |
| Prisma | 7.9.1 schema/generate/migrate/seed PASS; pg adapter; 1 migration; `pgcrypto`; 0 business tables; latest local health 95ms observed |
| Automated tests | 11 files/33 tests PASS |
| V8 coverage | statements 84.45%, branches 80.50%, functions 82.08%, lines 87.89% |
| Agenda isolation | partial unique stable-key index; 20 concurrent schedules -> 1 job/1 execution; graceful stop safe; Agenda credential denied on business DB |
| Redis/side effects/time | namespace isolation, safe-mode rejection and IANA/DST tests PASS |
| Staging PostgreSQL | roles distinct; runtime restricted; both client sockets encrypted; validate/migrate/seed/health PASS at 681ms; 1 migration, 0 business tables |
| Staging Agenda | Fresh TCP/TLS/connect/ping PASS; 0 all-database write scopes, 6 Agenda DB write scopes, business-DB denial PASS; duplicate stable key -> 1 stored job/1 execution; cleanup 0 probes; preflight duplicate groups 0 and unique stable-key index present (3 total indexes) |

## Blockers and review items

- `W1-STAGING-DB-001` (`RESOLVED` 2026-08-01): runtime and migration authenticate as distinct roles; runtime has no schema/database/create-role/create-database/superuser privileges, while migration retains required DDL. Migration/seed/runtime health remain green.
- `W1-STAGING-AGENDA-001` (`RESOLVED` 2026-08-01): the replacement credential has no all-database write scope, can write only the configured Agenda database and is denied on the business database. Real staging Agenda 5 adapter execution and cleanup pass. Native workstation SRV remains unavailable, so verification used an in-memory DNS fallback with Agenda 5's compatible MongoDB v4 driver; no seed list or secret was persisted.
- `W1-STAGING-TLS-001` (`RESOLVED` 2026-08-01): both ignored `.env` URLs use `uselibpqcompat=true&sslmode=require`, and direct inspection confirms encrypted runtime/migration sockets. Role separation and Prisma validate/migrate/seed/health remain green. This option-A resolution encrypts transport without CA/hostname verification; `verify-full` remains recommended hardening rather than a Wave 1 blocker.
- `W1-DEPENDENCY-AUDIT-001` is `OWNER_DEFERRED_NON_GATING` by DEC-060. Historical evidence is retained; no auto-fix or further audit work is in Wave 1 scope.
- `OPEN-005` remains a later production-hosting decision and is not resolved by Supabase staging configuration.
- `OPEN-012` is resolved by DEC-058 (Yarn canonical).
- `OPEN-013` is resolved by DEC-059 (Prisma 7.9.1 in Wave 1 with CommonJS generator output and pg adapter).
- `DEC-064` records the project-owner decision that only `DEPLOYMENT_ENV=production` forbids the V2 mount; any other label is non-production. Staging remains the only shared V2 deployment target before cutover.
- `W1-CODE-REVIEW-001` (`RESOLVED` 2026-08-01): nested secret redaction, MongoDB-enforced concurrent stable-key uniqueness and registry-only Agenda concurrency/lock policy were implemented and passed focused plus full verification.

Phase 2 and Wave 1 are `READY_FOR_REVIEW`, not `COMPLETED`; project-owner sign-off remains required. Wave 2 has not started.
