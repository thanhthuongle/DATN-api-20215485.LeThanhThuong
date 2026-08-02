# Wave 2 Controlled Dry-run Report

Ngày chạy/review: 2026-08-02. Target: hai PostgreSQL local database sạch độc lập. Source: fixture sanitize bất biến trong `scripts/run-wave2-controlled-dry-run.cjs`. Không kết nối hoặc ghi production database/provider.

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

W2-07 outcome: **PASS after review**. There is no unclassified error or unresolved `BLOCKING` discrepancy in the controlled run.
