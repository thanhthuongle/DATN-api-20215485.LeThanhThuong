# Wave 1 Staging Foundation

Ngày khởi tạo: 2026-08-01. Scope: Phase 2 infrastructure only; no V2 business schema, endpoint or financial write.

## Local stack

`docker-compose.dev.yml` remains the single local Compose file. It retains the existing Redis service and adds:

| Service | Version convention | Purpose | Persistence/isolation |
|---|---|---|---|
| `redis` | Redis 7 major | Existing V1 cache plus namespaced local V2 cache tests | Existing `./redis-data`; V2 keys require `V2_REDIS_NAMESPACE` |
| `postgres` | PostgreSQL 16 Alpine major | V2 local Prisma/migration/health | Named volume `postgres-v2-data` |
| `agenda-mongodb` | MongoDB 7 major, profile `v2` | Dedicated local Agenda 5 job store | Port 27018 and named volume `agenda-v2-data`; not the V1 business database |

Commands:

```powershell
docker compose -f docker-compose.dev.yml --profile v2 config
docker compose -f docker-compose.dev.yml --profile v2 up -d --wait
docker compose -f docker-compose.dev.yml --profile v2 ps
```

The checked-in local passwords are development-only defaults. They must never be reused in staging/production.

## Supabase staging connection shape

- Runtime Prisma uses the pooled TLS `POSTGRESQL_DATABASE_URL` with a restricted staging application role.
- Prisma Migrate/administration uses the direct TLS `POSTGRESQL_DIRECT_URL` with a distinct migration role.
- Both values contain credentials and are secrets. `POSTGRESQL_DIRECT_URL` normally has migration privileges and is the more sensitive of the two.
- Real URLs belong in an ignored local `.env` for developer-only verification or, preferably, the staging secret manager. Never paste them into chat, docs, source, logs or a commit; application/config code reads `process.env`.
- `.env.staging.example` contains placeholders only.
- Automated tests must reject Supabase/staging URLs and use disposable Testcontainers databases.
- `ACTIVE_FINANCIAL_WRITE_VERSION` remains `V1`; every V2 write flag remains false for this wave.

`OPEN-005` remains open for production hosting. Supabase here is staging only per DEC-017 and is not an implicit production decision.

## Isolation requirements

| Concern | Staging control | Evidence required before Phase 2 completion |
|---|---|---|
| PostgreSQL | Dedicated Supabase project/database and roles | TLS connection health without business tables/writes |
| Redis | Dedicated endpoint/database where available plus `hey-money:v2:staging` namespace | Key-prefix test |
| Agenda | Same cluster/server is allowed; only URI/database are configured; code owns `v2_jobs`, derives worker identity and requires a database-scoped read/write credential | Adapter integration/isolation test plus denial on business DB |
| Email | Sink provider mode | No production recipient delivery |
| Socket | Disabled or staging-only server | No production namespace/clients |
| Notifications | Capture-only provider | No production dispatch |

## Current evidence

W1-05 evidence (2026-08-01):

- Compose configuration rendered successfully with the `v2` profile.
- Docker Engine 29.2.0 started the extended stack; PostgreSQL 16, Redis 7 and Agenda MongoDB 7 reported `healthy` (3/3).
- `pg_isready` reported accepting connections; Redis returned `PONG`; the dedicated MongoDB probe resolved database name `agenda_v2` on local port 27018.
- No staging or production credential was exercised. Supabase staging connectivity remains pending an actual secret-managed staging configuration.

Clean migration/seed, Prisma health, scheduler isolation and final staging connectivity are appended by W1-06 through W1-10; configuration presence alone is not Phase 2 completion evidence.

W1-06 evidence (2026-08-01, refreshed after owner decisions):

- Prisma 7.9.1 uses the `prisma-client` generator with CommonJS output, the PostgreSQL driver adapter and generated TypeScript compiled by Babel. V1 remains CommonJS and did not move to ESM.
- `prisma validate`, client generation and the 145-file Babel build passed.
- `20260801180000_phase2_foundation` applied cleanly and is idempotent on re-deploy; it enables `pgcrypto` only and creates no V2 business table.
- The infrastructure seed executed `SELECT 1` and wrote no business data.
- Prisma local PostgreSQL health passed at 82ms after the explicit PostgreSQL environment-name migration; catalog evidence showed one completed migration, `pgcrypto` present and zero non-Prisma public tables.
- Yarn 1.22.22 and `yarn.lock` are canonical; frozen install and single-lock policy checks passed. `package-lock.json` was removed.

W1-07/W1-08 evidence (2026-08-01):

- Runtime: Node 22.22.0 passed the declared Node `>=20`; `.nvmrc` pins the Node 20 line at 20.19.0.
- Vitest 4, V8 coverage, Supertest 7 and Testcontainers 12 are configured. A disposable PostgreSQL container rebuilt the migration from empty and passed the production health implementation.
- `JobScheduler` and `Agenda5MongoScheduler` implement the six required methods. The test-only smoke job carries the complete registry metadata and no business side effect.
- Authenticated MongoDB Testcontainers evidence: 20 concurrent schedules with one stable key produced one stored Agenda job and one handler execution under a partial unique index; graceful stop was idempotent; the dedicated `readWrite` Agenda credential was denied when attempting to write the V1 business database.
- IANA reminder conversion/reschedule tests cover Asia/Ho_Chi_Minh and America/New_York DST; invalid zones fail and V2 contains no hard-coded +7-hour compensation.

W1-09 evidence (2026-08-01):

- Redis Testcontainer stored the same logical key under V1/V2 prefixes with distinct physical keys and values.
- Staging configuration rejects live email, production Socket and dispatch notification modes; only sink/disabled, staging-only/disabled and capture/disabled are accepted.
- Supertest confirms V2 correlation-ID propagation. Structured-log tests confirm JSON output, recursive object/array secret redaction and circular-reference handling.
- Feature-flag audit records require actor, reason, before/after and source version. Persistence/source-of-truth implementation is intentionally deferred; Redis is documented as cache only.

## Final Wave 1 gate

Local/automated evidence is complete: 3/3 Compose services healthy, clean Prisma 7 migration/seed, V1 disposable startup regression, 11 test files/33 tests and V8 coverage all pass. The local Compose services remain running for developer use.

Actual staging connectivity evidence was run on 2026-08-01 without recording credentials:

- Supabase pooled/runtime and session-pooler migration endpoints both connected. After credential rotation, Prisma validate, idempotent infrastructure-only migration, seed and runtime health passed; one migration is complete, zero business tables exist and the latest staging health latency was 568ms.
- Supabase isolation passed on recheck: the URLs authenticate as distinct roles. Runtime has no schema/database/create-role/create-database/superuser privileges; the migration role retains schema/database CREATE.
- Atlas SRV resolution fails through the machine's Node resolver, while DNS-over-HTTPS returned 3 SRV/1 TXT records and direct TCP/TLS plus authenticated MongoDB ping passed through an in-memory lookup fallback.
- The final fresh-connection authorization check passed: zero write scopes apply to all databases, six write scopes apply to the configured Agenda database, Agenda writes are allowed and V1 business-database writes are denied.
- The store configuration injects `AGENDA_DATABASE_NAME` when the supplied URI has no database path. Using the MongoDB v4 driver shipped with Agenda 5 plus verification-only in-memory DNS fallback, the real staging adapter accepted duplicate scheduling for one stable key as one stored job, executed the handler once and left zero probes after cleanup. Post-review preflight found 0 duplicate stable-key groups, then the code-owned partial unique `{ name, data.stableKey }` index was created and verified as unique; `v2_jobs` now has 3 indexes.

PostgreSQL connectivity/role isolation/TLS and Agenda credential isolation/execution all pass. Both ignored `.env` URLs now use `uselibpqcompat=true&sslmode=require`; direct client inspection reports encrypted runtime and migration sockets, and Prisma validate/migrate/seed plus health 681ms pass. This option-A configuration encrypts transport but does not verify CA/hostname; `verify-full` with the Supabase CA remains the recommended hardening path. The migration role currently retains elevated DDL/role/database-create capabilities and must not be exposed to application runtime. The workstation's native MongoDB SRV resolver limitation remains verification-only and no derived seed list or credential was written to disk.

Required unblock commands after secret injection:

```powershell
yarn prisma:validate
yarn prisma:migrate:deploy
yarn prisma:seed
yarn db:health:v2
yarn test:integration
```

The migration/seed commands must target an empty staging foundation database and remain free of business tables. Agenda staging verification must show the supplied worker credential can write only its dedicated job database/collection and is denied on business MongoDB.
