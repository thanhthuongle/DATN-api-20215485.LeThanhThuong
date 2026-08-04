# Wave 2 Local Fixture Validation Report

Ngày chạy/review: 2026-08-02. Target: hai PostgreSQL local database sạch độc lập. Source: fixture sanitize bất biến trong `scripts/run-wave2-controlled-dry-run.cjs`. Không kết nối hoặc ghi production database/provider.

Important scope correction: this is a deterministic local pipeline/schema validation only. It is not the Phase 3D dry run required by `master-plan.md`, because it does not export or transform a read-only copy of staging data. Phase 3D remains `IN_PROGRESS` until an authorized staging-copy run produces a source manifest, classified reject manifest, load/reconciliation report, and retained checksums.

Fixture-only identity exception: this local harness supplies deterministic UUIDs so two clean fixture databases can be compared byte-for-byte. That is not an approved staging loader behavior. The real staging-copy loader must omit `public_id` so PostgreSQL generates it, preserve `legacy_mongo_id` for traceability, and use source/business keys rather than generated UUIDs for deterministic reconciliation. The application role cannot insert `id`, `public_id` or legacy provenance columns.

## W2-07A authorized export inventory and sanitization boundary

W2-07A completed after corrective cycle 3 independent review with outcome **ACCEPT**. The owner-provided raw MongoDB BSON export remains outside the repository at `D:\Sghb\mongodb-heymoney-data\Heymoney-Data`; no raw BSON, metadata or source document was copied into or committed to this repository.

| Evidence | Actual result |
|---|---|
| Export artifacts | 31: 15 BSON files, 15 paired metadata files and one prelude |
| Declared collection routes | 26/26: 15 present and 11 explicitly absent/zero |
| Source records | 763 strict-EOF BSON records; invalid/duplicate ObjectId and malformed BSON fail closed |
| Raw inventory fingerprint | `767216c179b5b10a27e99e7594ec0d8c6a982a5e52ae7863d3202100df197b8c` |
| Semantic snapshot fingerprint | `a7bbcdf03dc93eef67597e4c503efaa2b0a4fb91fc62f10b7dd727f0f01a0769` |
| Current sanitized evidence fingerprint | `d1b25339902b9d3f032d6b527e9a3a5ea306e9bd1b80fbb781f3ab7e8a9adc41` (policy v3) |
| Sanitization | Operational capability and evidence tuples are fingerprint-bound and fail closed; zero detected secret/PII leak in evidence |
| Verification | W2-07A boundary and subsequent W2-07B1 hardening independently accepted |

This result proves the export reader, artifact/route manifest, immutable record-bound fingerprint and fail-closed sanitization boundary. W2-07A is accepted. The current v3 fingerprint supersedes the earlier policy-v2 operational evidence. The supplied export still does not by itself provide independently attested source-environment provenance or a complete point-in-time/staging export identity.

## W2-07B1 accepted transform plan

W2-07B1 completed after corrective cycle 5 with independent acceptance. It is a deterministic in-memory classification, transform and reconciliation plan over the authorized external export; it does not write PostgreSQL.

| Metric | Independent run 1 | Independent run 2 | Result |
|---|---:|---:|---|
| Source records | 763 | 763 | PASS |
| Loaded / archived / rejected | 756 / 7 / 0 | 756 / 7 / 0 | PASS |
| Blocking / unclassified | 0 / 0 | 0 / 0 | PASS |
| Balanced postings / entries | 128 / 256 | 128 / 256 | PASS |
| Balance holders / mismatches | 6 / 0 | 6 / 0 | PASS, tolerance 0 |
| Notifications / recipient states | 134 / 134 | 134 / 134 | PASS |
| Recipient received/read-state contract | 134/134 valid | 134/134 valid | PASS |
| Sanitized evidence fingerprint | `d1b25339902b9d3f032d6b527e9a3a5ea306e9bd1b80fbb781f3ab7e8a9adc41` | same | PASS |
| Transform plan hash | `054d208dc86819b67551841322ea80b906518d65a81b9ce934ffef7ff06b91fd` | same | PASS |

Verification at acceptance: focused 67/67, full unit 89/89 and full suite 104/104 tests PASS; targeted and full lint, syntax and whitespace checks PASS. W2-07B1 is accepted.

## W2-07B2 accepted owner-export PostgreSQL load

W2-07B2 executed the accepted source/evidence/transform plans against PostgreSQL 16 databases created and owned by the runner through Testcontainers. The runnable command was `node scripts/run-wave2-export-disposable-load.cjs --testcontainer`. The runner rejects explicit `DATABASE_URL` and non-disposable URL/query overrides before migration; it made no Supabase, staging, production or provider write.

| Evidence | Actual result |
|---|---|
| Semantic source snapshot | `a7bbcdf03dc93eef67597e4c503efaa2b0a4fb91fc62f10b7dd727f0f01a0769` |
| Sanitized evidence | `d1b25339902b9d3f032d6b527e9a3a5ea306e9bd1b80fbb781f3ab7e8a9adc41` |
| Transform plan | `054d208dc86819b67551841322ea80b906518d65a81b9ce934ffef7ff06b91fd` |
| Identity/space plan | `9f63d34167656f37f95225ed3ee8f13a7e05071eb096b0ce8ee588e7b12aaa53` |
| Database-derived target hash | `e74f8804f6d243ad95b80f2c398fcfeab9e53caef406dc0263c6444eae00048c`, identical on two clean databases |
| Source dispositions | 763 = 756 loaded + 7 archived + 0 rejected; 0 staged/unclassified/blocking |
| Checkpoints | 26/26 completed at reviewed dependency graph levels |
| Identity/ownership | 3 users, 3 personal spaces, 3 active owner memberships |
| Owned/reference targets | 21 banks, 207 categories/138 edges, 4 accounts, 2 accumulations, 2 contacts |
| Financial reconstruction | 30 ledgers; 128 balanced postings/256 entries; 124 source transaction headers |
| Other targets | 1 budget; 134 notifications/134 recipient states |
| Legacy assets | 3 `LEGACY_EXTERNAL` assets/attachments in `REQUIRES_REVIEW`: one user avatar, one expense image, one loan image |
| Reconciliation | 0 unbalanced transactions; 0 ledger projection mismatch; 6/6 balance holders exact, 0 mismatch at tolerance 0 VND |
| Repeatability | `prisma migrate deploy` twice, seed twice, same-run replay with fresh DB queries and target-hash recomputation; avatar-link corruption probe rejected |

PostgreSQL generated all business `id`/`public_id` values; deterministic comparison excluded generated identities and volatile timestamps. Each `LOADED` migration source record retained an actual target type/public ID, archived rows remained explicit, and reciprocal legacy-avatar provenance participated in the target hash.

W2-07B2 is accepted. W2-07 and W2-08 still await the next final full-Wave acceptance gate. The supplied owner export is valid source material for this disposable load but does not independently prove source-environment, immutable point-in-time or staging-copy provenance. Wave 3 remains `NOT_STARTED`.

## Result

| Metric | Run 1 | Clean rerun | Result |
|---|---:|---:|---|
| Source collection routes | 26/26 | 26/26 | PASS |
| Source records | 22 | 22 | PASS |
| Loaded records | 16 | 16 | PASS |
| Explicit archive-only records | 6 | 6 | PASS |
| Rejected records | 0 | 0 | PASS |
| Unclassified errors | 0 | 0 | PASS |
| Blocking discrepancies | 0 | 0 | PASS |
| Posted transactions | 5 | 5 | PASS |
| Unbalanced transactions | 0 | 0 | PASS |
| Ledger projection mismatches | 0 | 0 | PASS |
| Balance holders compared | 3/3 | 3/3 | PASS |
| Balance mismatch tolerance | 0 VND | 0 VND | PASS |
| Balance mismatches | 0 | 0 | PASS |
| Transfer fee ledger effect | 0 VND | 0 VND | PASS, DEC-065 |
| Database-derived target snapshot | 17 canonical groups / 89 rows | same | PASS |
| Sanitized migration evidence | 22 hashes / 0 mismatch / 0 secret leak | same | PASS |
| Schema verification | 45 tables / 4 safe views / 52 enums / 105 FK / 70 CHECK / 50 triggers | same | PASS |

Deterministic evidence:

```text
sourceChecksum = 7695a5af5504c4c684d81bcfb4bb3cfa88e7cfee4556d10f0fc5b277609dd074
targetHash     = 9c743816ebd15e71aa57dc76fe6eb3198b2ec49709b7bb904e4f6a0fa43417eb
```

Both hashes matched on the independent clean rerun. `targetHash` is derived by re-querying 89 persisted rows across 17 stable PostgreSQL target groups; internal identities and volatile database timestamps are excluded.

## Data-quality classification

| Class | Controlled result | Rule |
|---|---|---|
| Missing/null required values | 0 | financial/ownership missing rejects `BLOCKING` |
| Orphan ObjectId/FK | 0; database FKs active | unresolved financial/ownership relation rejects `BLOCKING` |
| Duplicate source/business relation | 0 | conflicting duplicate is never last-write-wins |
| Invalid/unsafe money | 0/financial sample values | safe integer VND only |
| Invalid rate/rate basis | 0 records inspected; fixture and Wave 0 production both contain 0 saving rows | future invalid/ambiguous rate is `BLOCKING`; no inferred interest |
| Balance mismatch | 0/3, total/max difference 0 VND | tolerance 0; no migration anchor created |
| Archive-only schema rows | 6/6 classified | money-source envelope plus five schema/Agenda lanes; no financial posting |
| Asset/provider side effects | 0 calls | discovery/load never uploads or deletes provider objects |

## Loaded financial sample

Two accounts were reconstructed from signed opening balances plus one income, one expense and one same-space transfer. Five POSTED transactions produced ten immutable ledger entries. The stored balances `1,050 VND` and `550 VND`, plus one zero accumulation, matched reconstructed balances exactly. The sample transfer preserved fee `25 VND` as metadata and produced `0 VND` fee ledger effect.

## Limits retained for later phases

- This proves the approved pipeline/schema on controlled sample data; it is not the final production freeze rehearsal.
- Production Wave 0 profile remains the actual live-data evidence: 6/6 balance holders matched at 0 VND, 0 saving rows, four provider orphans and four unversioned Agenda payloads already classified.
- Final cutover must rerun against an immutable snapshot, exercise the full source population, retain provider manifest evidence and complete at least three deterministic rehearsals.

Local fixture outcome: **PASS**. W2-07/Phase 3D outcome: **PENDING_STAGING_EVIDENCE**. There is no unclassified error in this fixture, but that result cannot establish the condition of staging data.
