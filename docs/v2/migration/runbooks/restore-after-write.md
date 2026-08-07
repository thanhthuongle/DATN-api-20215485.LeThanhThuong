# Restore After Write — Runbook

> **Runbook ID:** RAW-001
> **Wave:** 8 (Phase 12 — Cutover/Hypercare)
> **Owner:** Cutover lead + DBA + on-call engineer
> **Audience:** Operators with production DB + backup access
> **Pre-requisite:** A backup taken **before** the cutover window exists and is verified restorable

---

## 1. Purpose

This runbook documents how to **restore the database** to a known-good state **after** V2 writes have been opened and a data-integrity incident is detected.

**Golden rule:** Restore is a last resort. Prefer `rollback-before-write.md` if the window is still open and data loss is limited.

---

## 2. When to execute

| Trigger | Condition |
|---|---|
| Data corruption detected post-cutover | Ledger imbalance, missing transactions, or phantom entries after V2 write authority opened |
| Unrecoverable V2 bug | V2 code produces bad data faster than it can be patched in-place |
| Hosting / disk failure | Production PostgreSQL lost or unrecoverable |
| Operator-initiated disaster | Accidental mass delete, bad migration, or env misconfiguration |

**Do NOT execute** if:
- The incident can be fixed by `rollback-before-write.md` (V1 still healthy).
- The pre-cutover backup is older than 30 days (policy violation — escalate to DBA).
- You have not read this runbook end-to-end and briefed the on-call lead.


## 3. Backup inventory (pre-flight, 5 minutes)

```bash
# 1. List available backups
ls -lah /backups/postgres/

# Expected files:
#   pre-cutover-<YYYY-MM-DD>.sql.gz        (mandatory)
#   pre-cutover-<YYYY-MM-DD>.sha256        (mandatory)
#   rolling-<YYYY-MM-DD>.sql.gz            (optional, daily)
#   mongo-pre-cutover-<YYYY-MM-DD>.archive (MongoDB retirement reference)

# 2. Verify checksum of the mandatory pre-cutover backup
cd /backups/postgres
sha256sum -c pre-cutover-<YYYY-MM-DD>.sha256
# Expected: OK

# 3. Record the chosen backup timestamp (used in §5)
export RESTORE_TARGET="pre-cutover-<YYYY-MM-DD>"
```

If checksum fails or no pre-cutover backup exists → **ESCALATE TO DBA IMMEDIATELY**. Do not proceed with an unverified backup.

---

## 4. Incident response checklist (parallel)

| Role | Action |
|---|---|
| Cutover lead | Declare incident; open incident war-room |
| On-call engineer | Execute §5 (restore steps) |
| DBA | Validate backup integrity + assist with PITR if needed |
| Product owner | Decide whether to accept data-loss window (time between last good backup and incident) |
| Comms | Update stakeholders every 15 min until resolved |


---

## 5. Restore steps

### Step 1: Stop write traffic (2 minutes)

```bash
# Put API into maintenance mode (if supported by hosting platform)
# Railway/Render: enable maintenance page / pause workers
# Fallback: scale API workers to 0

# Verify no new connections
psql $POSTGRESQL_DIRECT_URL -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
# Expected: 0 (or only this restore session)
```

### Step 2: Take a final forensic snapshot (2 minutes, DO NOT SKIP)

```bash
# Snapshot the CURRENT (corrupted) state for post-mortem
pg_dump $POSTGRESQL_DIRECT_URL \
  --format=custom \
  --file="/backups/postgres/forensic-$(date +%Y%m%d-%H%M%S).dump" \
  --no-owner --no-acl

# Record incident timestamp
export INCIDENT_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "Incident timestamp: $INCIDENT_TIMESTAMP"
```

### Step 3: Drop and recreate target database (3 minutes)

```bash
# WARNING: this destroys all current data
# Confirm you have the correct RESTORE_TARGET from §3

psql $POSTGRESQL_DIRECT_URL <<SQL
DROP DATABASE IF EXISTS ${POSTGRES_DB}_restore_tmp;
CREATE DATABASE ${POSTGRES_DB}_restore_tmp;
SQL

# Restore backup into temp DB
gunzip -c /backups/postgres/${RESTORE_TARGET}.sql.gz \
  | psql $POSTGRESQL_DIRECT_URL --dbname ${POSTGRES_DB}_restore_tmp
```

### Step 4: Validate restored data (3 minutes)

```bash
# Run the same reconciliation gates as cutoverPrerequisites
psql $POSTGRESQL_DIRECT_URL -d ${POSTGRES_DB}_restore_tmp -c "
  SELECT
    (SELECT count(*) FROM discrepancy_cases WHERE severity='BLOCKING' AND status NOT IN ('RESOLVED','IGNORED')) AS blocking,
    (SELECT count(*) FROM financial_transactions ft WHERE status='POSTED' AND (
       SELECT abs(coalesce(sum(le.amount),0)) FROM ledger_entries le WHERE le.financial_transaction_id=ft.id
    ) <> 0) AS unbalanced
  ;
"
# Expected: 0 | 0
```

If gates do not pass → investigate backup corruption before proceeding.

### Step 5: Swap databases (1 minute)

```bash
# Atomic swap using transaction
psql $POSTGRESQL_DIRECT_URL <<SQL
BEGIN;
  -- Rename current (corrupted) to archive
  ALTER DATABASE ${POSTGRES_DB} RENAME TO ${POSTGRES_DB}_corrupted_${INCIDENT_TIMESTAMP};
  -- Promote restored to live
  ALTER DATABASE ${POSTGRES_DB}_restore_tmp RENAME TO ${POSTGRES_DB};
COMMIT;
```

### Step 6: Restart API + verify V1 health (2 minutes)

```bash
# Scale workers back up / disable maintenance mode
curl -s http://localhost:3000/api/v1/health | jq .
# Expected: status == "ok"

# Verify write path works end-to-end
curl -X POST http://localhost:3000/api/v1/transactions \
  -H "Authorization: Bearer $V1_TOKEN" \
  -d '{"space_id":"<test-space>","amount":1000,"type":"income"}'
# Expected: 200
```

### Step 7: Run full prerequisite check

```bash
node scripts/verify-cutover-prerequisites.cjs --from-json ./snapshot-clean.json
# Expected: GO (or NO-GO with documented exceptions)
```

---

## 6. Post-restore actions

| Action | Owner | Deadline |
|---|---|---|
| Root-cause analysis | On-call + DBA | Within 24 hours |
| Backup retention policy review | DBA | Within 48 hours |
| Update `restore-after-write.md` with lessons learned | Cutover lead | Within 72 hours |
| Re-schedule cutover (if applicable) | Product owner | After RCA sign-off |

---

## 7. Data-loss tolerance matrix

| Scenario | Acceptable loss window | Action |
|---|---|---|
| Pre-cutover backup < 1 hour old | 0 transactions lost | Restore + retry cutover same day |
| Pre-cutover backup 1–24 hours old | Up to 24 hours of V2 writes | Restore + manual reconciliation of delta |
| Pre-cutover backup > 24 hours old | Escalate to DBA for PITR | Do NOT restore without DBA sign-off |

---

## 8. References

| Artifact | Path |
|---|---|
| Pre-cutover backup location | `/backups/postgres/` (infra-dependent) |
| Rollback runbook | `docs/v2/migration/runbooks/rollback-before-write.md` |
| Write authority module | `src/v2/infrastructure/cutover/writeAuthority.js` |
| Prerequisite checker | `src/v2/infrastructure/cutover/cutoverPrerequisites.js` |
| Master plan §16 | `docs/v2/migration/master-plan.md` |
| Decision register | `docs/v2/migration/decision-register.md` (DEC-025, DEC-026) |
