# V1 Cloudinary and File Lifecycle Inventory

Ngày inventory: 2026-08-01. Target decision: DEC-053 temporary asset lifecycle; no V1/V2 runtime change is made here.

## 1. Upload boundary

| Item | V1 evidence |
|---|---|
| HTTP parser | Multer memory storage (no disk destination configured). |
| MIME allowlist | `image/jpg`, `image/jpeg`, `image/png`. |
| Size | 10 MiB per file through `limits.fileSize`. |
| Multiplicity | avatar single; family background single; individual transaction `images` max 5. |
| Provider | Cloudinary `uploader.upload_stream({folder})`; only `secure_url` consumed. |
| Persisted metadata | URL string only; no Cloudinary public/resource ID, checksum, bytes, MIME, owner, upload session, state or expiry. |
| Delete/replacement | no `uploader.destroy`, `delete_resources`, cleanup job or compensating operation in source. |

Static scan: **10/10 `CloudinaryProvider.streamUpload` call sites** inventoried across three folders.

## 2. Call-site/lifecycle register

| ID/source | Asset/folder | Sequence | DB failure behavior | Owner/status |
|---|---|---|---|---|
| FILE-001 `userService.js:176` | avatar / `users` | upload -> update user.avatar | successful upload becomes orphan if DB update fails; replacement never deletes old avatar | identity/assets / ACTIVE |
| FILE-002 `familyService.js:41` | background / `familyBackgrounds` | create family/categories/money-source in transaction -> upload -> update family -> commit | upload error is swallowed and family commits without image; DB abort after upload leaves orphan; retry callback can upload again | families/assets / ACTIVE |
| FILE-003 `expenseService.js:31` | images / `transactionImages` | validate source/balance -> parallel upload -> detail -> balance | any later abort leaves uploaded assets; partial Promise.all success can orphan files | transactions/assets / ACTIVE |
| FILE-004 `incomeService.js:26` | same | validate target -> upload -> detail -> balance | same | transactions/assets / ACTIVE |
| FILE-005 `transferService.js:37` | same | validate source/target/balance -> upload -> detail -> two balances | same | transactions/assets / ACTIVE |
| FILE-006 `loanService.js:37` | same | validate -> upload -> detail -> balance -> Agenda | upload/job/DB boundaries mixed | debt/assets / ACTIVE |
| FILE-007 `borrowingService.js:34` | same | validate -> upload -> detail -> balance -> Agenda | same | debt/assets / ACTIVE |
| FILE-008 `repaymentService.js:47` | same | validate -> upload -> detail -> balance -> Agenda cancel | same | debt/assets / ACTIVE |
| FILE-009 `collectionSevice.js:44` | same | validate -> upload -> detail -> balance -> Agenda cancel | same | debt/assets / ACTIVE |
| FILE-010 `contributionService.js:22` | same | **upload and detail before referenced resources are validated** -> balances | missing reference after upload leaves assets outside aborted DB transaction | contribution/assets / ACTIVE |

All transaction upload calls run inside the logical Mongo transaction callback invoked by `runTransactionWithRetry`, but Cloudinary is not part of MongoDB atomicity. A transient retry can repeat uploads even if MongoDB rolls back.

## 3. File references in data/contracts

| Source field | Shape | Producer/input risk | Migration owner |
|---|---|---|---|
| `users.avatar` | nullable URL string | server upload or legacy arbitrary string through broad update path may be possible | identity/assets |
| `families.backgroundImage` | nullable URL string | server upload; upload failure intentionally tolerated | families/assets |
| detail `images[]` on 8 active financial subtype models | URL string array | individual multipart uploads overwrite detail images when files exist; Joi also accepts client-supplied arbitrary strings when no files | transactions/assets |
| `group_payouts.images[]`, `proposal_expenses.images[]` | URL string array | schema-only; no active producer | archive/data owner |

There is no attachment entity or ownership relation. A URL does not prove the file belongs to the actor/financial space or even to this Cloudinary account.

## 4. Lifecycle state assessment

| Lifecycle phase | V1 status | Required V2 behavior |
|---|---|---|
| Reserve/upload | direct final upload | create temporary asset with owner/upload session, checksum, MIME, size, expiry |
| Validate ownership | absent | asset reference scoped to actor/financial space |
| Link to business record | URL copied into document | DB attachment `PENDING` inside transaction using temporary asset ID |
| Finalize | absent | post-commit outbox transitions attachment/asset ACTIVE idempotently |
| Retry | new upload each request | same idempotency key reuses linked asset/result |
| DB rollback | no compensation | temporary remains eligible for delayed cleanup |
| Replace/delete | old URL abandoned | outbox/compensating delete with audit retention policy |
| Cleanup | absent | scheduled safe-expiry cleanup, initially 24h per V2 runtime doc |
| Investigation | no asset audit | discrepancy evidence without embedding secrets/PII |

## 5. Production data/provider profile

MongoDB URL manifest and Cloudinary Admin API resource listing were read-only profiled on 2026-08-01. Public IDs in examples are represented by 16-character SHA-256 prefixes; no URL, credential or PII is stored.

| Check | Count | Rule owner |
|---|---:|---|
| user avatar URLs | 1 | identity/assets |
| bank logo URLs | 21, all non-Cloudinary | banks/assets |
| family background URLs | 0; families collection absent | families/assets |
| financial detail image URLs | 2: expense 1, loan 1 | transactions/assets |
| All DB URL references | 24; Cloudinary 3; non-Cloudinary 21; invalid 0; duplicate URL references 0 | assets/migration |
| DB Cloudinary URLs missing at provider | 0/3 | assets/infrastructure |
| Provider resources | 7: users 1, familyBackgrounds 3, transactionImages 3 | assets/infrastructure |
| Provider resources unreferenced by DB | **4/7**; hash examples `b3d58468d84b7470`, `2bccd17da5181d8a`, `cc01bdd350c0dd89`, `95580bb3f97a4d4c` | assets/infrastructure; quarantine/report, no deletion |
| Duplicate content/checksum | Not derivable from V1 URL fields/resource-list response; duplicate URL count is 0 | assets/migration; compute checksum only in later controlled asset migration |

Required evidence sources: sanitized DB URL manifest plus Cloudinary read-only resource manifest (`public_id`, secure URL, folder, bytes, format, created time). Compare canonical public/resource IDs, not URL substring alone. Do not delete any asset during Wave 0.

## 6. Findings

| ID | Finding | Severity/action |
|---|---|---|
| ASSET-001 | upload occurs before database commit and inside retry callbacks. | CRITICAL orphan/duplicate risk; temporary asset + outbox per DEC-053 |
| ASSET-002 | only secure URL is persisted, so reliable lifecycle/delete/audit identity is absent. | MAJOR; capture provider public ID during migration where provable |
| ASSET-003 | no delete, replacement cleanup or orphan collector exists. | MAJOR; define retention/cleanup job |
| ASSET-004 | client can supply arbitrary image strings through transaction detail schema. | SECURITY; server-owned temporary asset ID only in V2 |
| ASSET-005 | MIME derives from multipart metadata; no content signature/checksum evidenced. | SECURITY; inspect content, checksum and size |
| ASSET-006 | contribution uploads before reference validation. | CRITICAL orphan amplification |
| ASSET-007 | Four provider resources are not referenced by the profiled DB. | REQUIRES_REVIEW; preserve/quarantine until retention ownership is approved, never auto-delete. |

## 7. Draft migration rules

1. Preserve every legacy URL and source document/path as provenance; never silently drop an unparseable URL.
2. Valid, reachable provider resource with uniquely resolved public ID -> create asset + attachment linked to migrated owner/resource.
3. Valid URL but provider identity unavailable -> archive as `LEGACY_EXTERNAL_URL`, mark `REQUIRES_REVIEW`; do not fabricate ownership.
4. Duplicate URL references -> one asset may have multiple attachment rows only when ownership/audit policy permits; duplicate attachment edges are deduplicated with evidence.
5. Missing provider resource or malformed URL -> discrepancy; financial business record still migrates, attachment state records missing evidence.
6. Provider orphan -> quarantine/report first; deletion requires later approved retention runbook, never Wave 0.

## 8. Review record

- Coverage: all 10 upload call sites, 3 provider folders, Multer routes, 12 schema fields/groups and absence of deletion APIs reviewed.
- Ordering review: upload-before-DB, retry, partial Promise.all, replacement and client-URL risks classified.
- Live DB/provider counts are recorded; all 3 DB Cloudinary references resolve, while 4/7 provider resources are unreferenced and classified with an owner/rule.
- Wave 0 asset metric is complete; rerun the manifest comparison at final freeze because both systems remain live.
- Diff review: docs only; no Cloudinary upload/delete, credential or production file changed.
