# V1 Data Quality and Balance Reconstruction Report

Ngày cập nhật: 2026-08-01. Tolerance balance: **0 VND** theo DEC-044.

## 1. Execution status

| Check | Status | Actual metric | Evidence |
|---|---|---:|---|
| Read source schema/financial mutations | COMPLETED | 26 model schemas; 22 balance mutation sites | `mongodb-inventory.md`, `financial-flows.md` |
| Run read-only MongoDB profile | COMPLETED | 2 successful runs | Development `2026-08-01T03:46:53.799Z`; production `2026-08-01T03:47:34.487Z`. Direct Atlas seed-list connection was used because Node SRV resolution failed; credentials were not recorded. |
| Reconstruct active account balances | COMPLETED | 4/4 matched | stored/reconstructed totals both `114,020,900 VND` |
| Reconstruct active accumulation balances | COMPLETED | 2/2 matched | stored/reconstructed totals both `0 VND` |
| Reconstruct active saving balances | COMPLETED | 0 active records | no saving record exists in the profiled database |
| Compare stored/reconstructed at 0 VND | COMPLETED | matched 6; mismatched 0 | total difference `0 VND`; max absolute difference `0 VND` |

Production and development returned the same collection/count/reconstruction result. The production result is the Wave 0 acceptance evidence; the development run is a consistency check, not a substitute.

## 2. Read-only profiler

Script: `docs/v2/migration/scripts/v1-readonly-profile.mjs`.

Controls:

- selects the configured development URI unless `BUILD_MODE=production`;
- never prints URI, credential or database name;
- `readPreference=secondaryPreferred`, `retryWrites=false`;
- only invokes `listCollections`, `countDocuments`, `find` and `listIndexes`;
- writes no database/document and emits aggregate metrics plus at most five redacted/ObjectId-only examples per issue group.

The script can be rerun from a network with MongoDB Atlas DNS/access:

```text
node docs/v2/migration/scripts/v1-readonly-profile.mjs
```

The JSON output must be captured as controlled migration evidence after reviewing that it contains no PII.

## 3. Reconstruction rule v1

Only active headers/details/resources (`_destroy !== true`) participate. Each active subtype detail resolves its header through `detail.transactionId`; missing/inactive header is an orphan and contributes no silent delta.

Signed deltas from V1 evidence:

| Detail type | Source delta | Target delta |
|---|---:|---:|
| expense | `moneyFrom -amount` | — |
| income | — | `moneyTarget +amount` |
| transfer | `moneyFrom -amount` | `moneyTarget +amount` |
| loan | `moneyFrom -amount` | — |
| borrowing | — | `moneyTarget +amount` |
| repayment | `moneyFrom -amount` | — |
| collection | — | `moneyTarget +amount` |
| contribution | `moneyFrom -amount` | `moneyTarget +amount` |

Per entity:

```text
account reconstructed = initBalance + signed detail deltas
accumulation reconstructed = 0 + signed detail deltas
saving reconstructed = 0 + signed detail deltas
```

The saving rule deliberately does **not** invent direct interest credits. Source shows monthly/maturity/close/rollover interest can call `savingsAccountModel.increaseBalance` without a distinct header/detail financial event. Such differences must remain discrepancies until a deterministic legacy-interest rule is approved.

## 4. Known mismatch classes before execution

| Class | Why it can occur | Count | Severity/rule owner |
|---|---|---:|---|
| BAL-OPENING | account `initBalance` is stored without transaction history | 4 accounts used an explicit reconstruction base; 0 mismatches | expected reconstruction base; transaction/migration owner |
| BAL-INTEREST | saving interest direct balance credit is absent from transaction history | 0 observed; no saving records | rule remains required for future/final snapshots; savings owner |
| BAL-FAMILY-SAVING | family saving source writes initial balance while dispatch call signature appears invalid | 0 observed; no saving/family records | source risk retained; savings/transactions owner |
| BAL-PARTIAL-MONTHLY | direct interest increment may commit before transfer fails | 0 observed; no saving records | source risk retained; savings/jobs owner |
| BAL-ACCUMULATION-CLOSE | transfer and `isFinish/balance=0` use separate boundaries | 0 mismatches across 2 active accumulations | source risk retained; accumulations owner |
| BAL-ORPHAN-DETAIL | detail has missing/inactive transaction header | 0/124 active details | transactions owner |
| BAL-MISSING-DETAIL | transaction header has no correct subtype detail | 0/124 active headers based on type/detail count and IDs | transactions owner |
| BAL-DUP-DETAIL | multiple active details share one transactionId | 0 duplicate keys across 8 detail collections | transactions owner |
| BAL-INVALID-MONEY | balance/initBalance/amount is missing, non-integer or unsafe | 0 across 6 balance records and 124 active details | migration owner |
| BAL-NEGATIVE | stored balance negative outside allowed legacy normal-account policy | 0/6 balance records | accounts/savings owner |

## 5. Required result payload and acceptance

Production run result:

| Entity | Active | Matched | Mismatched | Invalid money | Negative stored | Stored total | Reconstructed total | Difference | Max abs difference |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| accounts | 4 | 4 | 0 | 0 | 0 | 114,020,900 | 114,020,900 | 0 | 0 |
| accumulations | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| savings_accounts | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

The approved run records:

- active record count;
- valid/invalid monetary field count;
- matched and mismatched counts at tolerance 0;
- stored total, reconstructed total, total difference and max absolute difference;
- negative stored count;
- up to five redacted/ObjectId-only examples;
- source snapshot identifier/time, environment owner and reviewer.

W0-04 acceptance is reached for the profiled production snapshot: all 6 active balance-bearing records were classified, all matched at tolerance `0 VND`, and no migration anchor is required. Per DEC-044, the same check must be rerun against the immutable final-cutover snapshot; this result does not waive future reconciliation.

## 6. Connectivity resolution

`W0-DATA-ACCESS-001` is resolved on 2026-08-01. PowerShell resolved the Atlas SRV/TXT records, while Node's SRV resolver returned `ECONNREFUSED`/`ETIMEOUT`. The reviewed workaround derived the standard TLS seed-list URI in process memory from the read-only `.env` credential and Atlas DNS records. No URI/credential was printed or written, and the profiler still used only `listCollections`, `countDocuments`, `find` and `listIndexes`.

## 7. Review record for W0-04

- Reconstruction formula is traceable to all eight subtype services/models and opening-balance source behavior.
- Profiler passed syntax review (`node --check` is required in task review) and contains no database mutation operation.
- Development and production read-only runs completed; production execution timestamp is `2026-08-01T03:47:34.487Z`.
- Result: accounts 4/4 matched, accumulations 2/2 matched, savings 0 records, mismatch 0 and total/max difference 0 VND.
- Task outcome: **COMPLETED after review**. Final-cutover snapshot must still rerun the same deterministic check.

## 8. W0-09 missing/null/type/duplicate/orphan catalog

Production profile version 2 was reviewed at `2026-08-01T04:03:52.238Z`. The database is live, not a frozen cutover snapshot; counts can change and must be rerun at final freeze.

## Wave 2 controlled transform/load dry-run

Phase 3D ran the approved mapper/load boundary twice from clean local PostgreSQL databases using sanitized fixture `wave2-sanitized-sample-v1`. Both runs produced identical source checksum `7695a5af5504c4c684d81bcfb4bb3cfa88e7cfee4556d10f0fc5b277609dd074` and target hash `591684e02e2b2c74e0382c740f6402b6728209d5368a0131b167ea9d506d176e`.

- 26/26 collection routes and checkpoints; 22 source rows = 16 loaded + 6 explicitly archived + 0 rejected.
- Missing/orphan/duplicate/unsafe-money/unclassified counts: 0; invalid-rate count 0 over 0 saving rows, matching the Wave 0 source population characteristic.
- Five posted transactions, ten ledger entries, zero unbalanced posting.
- Three balance holders compared, zero mismatch at tolerance 0 VND; no `MIGRATION_EQUITY` anchor created.
- Zero production/provider writes. Full evidence and retained limitations: `docs/v2/migration/wave-2-dry-run-report.md`.

- 15 live collections; 26 source-declared collections, of which 11 are absent/empty: `families`, `savings_accounts`, `transfers`, `contributions`, `borrowings`, `collections`, `repayments`, `contribution_requests`, `group_payouts`, `invitations`, `proposal_expenses`.
- 16 indexes across live collections; 0 non-`_id` unique indexes. Agenda contributes the additional internal index beyond the 15 default `_id` indexes.
- 124 active transaction headers/details: 118 expense, 4 income and 2 loan; every header has its expected detail.
- The profiler executed 26 direct relation checks plus category-graph, budget-embedded, money-source reverse-link and header/detail integrity checks.

| ID/class | Checks | Count | Example | Rule owner/status |
|---|---|---:|---|---|
| DQ-001 missing/null | Required fields from all 26 source schemas; distinguish missing vs explicit null; audit-field exceptions | 0 documents; missing 0; explicit null 0 | none in active records | entity owner; rerun at freeze, reject/archive future invalid records |
| DQ-002 money type/range | amount/initBalance/balance integers and safe range; rates finite; negative balance policy | invalid integer 0; unsafe integer 0; invalid rate 0; negative stored 0/6 | none | financial migration; future invalid value is `BLOCKING` |
| DQ-003 timestamp | Invalid Date/ms/ISO values and UTC/local-day classification | invalid 0; ISO strings without offset 0; UTC day differs from Asia/Ho_Chi_Minh day 8 | BSON forms observed: Date, epoch number and 3 ISO reminder strings | time/migration; preserve instant, apply rules from `timezone-inventory.md` |
| DQ-004 enum | owner/source/transaction/account/status values; legacy `orther` | invalid 0; `orther` 0; accounts: bank 3, wallet 1 | source enum still contains `ACCOUNT_TYPES.OTHER='orther'` | explicit canonical transform remains for future/final snapshot |
| DQ-005 user duplicate | normalized email duplicates | 0 keys / 0 records | none | identity; conflicting duplicates require review |
| DQ-006 bank duplicate | normalized bank code and name | 0 keys / 0 records for both | none | banks; seed/business-key reconciliation |
| DQ-007 owner duplicate | active money_sources with same ownerType/ownerId | 0 keys / 0 records | none | accounts; no merge required in current snapshot |
| DQ-008 contact/category duplicate | owner-scoped normalized names/type | 0 keys / 0 records | none | contacts/categories |
| DQ-009 detail duplicate | same transactionId within/across subtype collections | 0 keys / 0 records | none across 124 details | transactions; future conflict is `BLOCKING` |
| DQ-010 array duplicate/type | family/source/transaction/category/contributor/image arrays | invalid array type 0; duplicate elements 0 | none | relation owner |
| DQ-011 owner orphan | polymorphic ownerId missing/inconsistent | 0 missing | 207 categories, 3 money sources, 4 accounts, 2 accumulations, 2 contacts, 1 budget and 124 transactions checked | module/migration |
| DQ-012 money-source orphan | child moneySourceId and reverse arrays missing/conflicting | forward missing 0/6; reverse missing 0; wrong/orphan reverse entry 0 | none | accounts; future financial relation error is `BLOCKING` |
| DQ-013 transaction relation orphan | category/responsible/detail/header/source/target | owner/category/responsible missing 0/124 each; header/detail missing 0; money references missing/invalid type 0/124 | none | transactions; future financial link error is `BLOCKING` |
| DQ-014 debt orphan/type | borrower/lender/original debt relation and selected mixed BSON | loan borrower missing 0/2; other debt collections absent; mixed fields have 0 records | none | debt; rerun when those collections contain data |
| DQ-015 membership orphan | family owner/manager/member and role arrays | 0 references because families collection is absent | none | families/identity; empty-data classification, not proof future records are valid |
| DQ-016 notification orphan | user_notification missing user or notification | user missing 0/131; notification missing 0/131 | none | notifications |
| DQ-017 category/budget embedded | graph orphan/self/asymmetry; budget embedded refs/shapes | graph 0/0/0; 1 allocation, invalid shape 0, orphan category/transaction refs 0 | none | budgets/categories |
| DQ-018 soft-delete link | active document points to `_destroy:true` target | 0; no source document has `_destroy:true` | none | entity owner; preserve historical financial data in future snapshots |
| DQ-019 asset quality | malformed/duplicate/missing-provider URL and provider orphan | 24 DB URLs; invalid 0; duplicate 0; 3 Cloudinary refs, missing at provider 0; **4 provider orphans** | SHA-256 prefixes: `b3d58468d84b7470`, `2bccd17da5181d8a`, `cc01bdd350c0dd89`, `95580bb3f97a4d4c` | assets: `REQUIRES_REVIEW`, quarantine/report only; no Wave 0 delete |
| DQ-020 Agenda quality | pending/running/repeating/duplicate/stale/unknown/version | total/active 4/4; repeating 1; pending 1; locked/stale/failed/duplicate/unknown 0; **unversioned payload 4** | `6866095d29cbf2ee079ec5a5` `send_reminder` (plus 3 same-name examples in `background-jobs.md`) | jobs/platform: version and reschedule by stable key; no blind store copy |

All 20 classes now have an actual production-snapshot count and rule owner. Zero-count classes explicitly record `none`; the two non-zero classes have redacted examples and remediation rules. No financial/data-relation issue remains `BLOCKING` in this snapshot.

## 9. Duplicate/orphan migration policy draft

- Exact duplicate: retain one canonical row only when all business and ownership fields match; record every legacy ID mapping and dedup evidence.
- Duplicate business key with conflicting values: no automatic merge; create `REQUIRES_REVIEW`/`BLOCKING` discrepancy according to financial impact.
- ObjectId orphan: never attach to a guessed owner/target. Preserve source ID and reject/archive or remediate by approved evidence.
- Polymorphic reference: resolve using companion type first; an ID found in another collection does not authorize coercion.
- Array duplicate: deduplicate child/join edge by approved business key; count original positions; preserve order only where contract evidence requires it.
- Active -> soft-deleted reference: classify separately from absent target; do not resurrect silently.
- Financial header/detail mismatch: blocking; never synthesize amount/posting merely to match balance.
- Invalid monetary/timestamp value: keep raw staging value and reject code; no fallback zero/current time.

## 10. Review record for W0-09

- Production read-only profiling completed through a derived TLS seed-list because Node SRV resolution failed; no credential was printed/written.
- Profiler version 2 covers 26 source collections, required/null/type/range/time/enum/array checks, indexes, duplicates, 26 direct relations, composite graph/reverse/header-detail checks, Agenda, assets and balance reconstruction.
- `node --check` passes; static scan finds no insert/update/delete/bulk-write operation.
- Cloudinary read-only manifest found 7 provider resources: users 1, familyBackgrounds 3, transactionImages 3; 4 are unreferenced by DB and are classified `REQUIRES_REVIEW`, not deleted.
- Task outcome: **COMPLETED after review**. Counts must be rerun against the immutable final-cutover snapshot because production remained live during Wave 0 profiling.
