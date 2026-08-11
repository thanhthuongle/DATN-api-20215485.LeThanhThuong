# Rollback Before Write — Runbook

> **Runbook ID:** RBW-001
> **Wave:** 8 (Phase 12 — Cutover/Hypercare)
> **Owner:** Cutover lead + on-call engineer
> **Audience:** Operators with production DB access
> **Pre-requisite:** `ACTIVE_FINANCIAL_WRITE_VERSION` currently set to `V2` (or cutover window is open)

---

## 1. Purpose

This runbook documents the **safe, reversible steps** to roll back write authority from V2 back to V1 **before** or **during** the cutover window, without losing data or violating the dual-authority invariant.

**Golden rule:** V1 must remain the authoritative write path until this rollback is verified complete.

---

## 2. When to execute

| Trigger | Condition |
|---|---|
| Prerequisite gate failure mid-window | `verify-cutover-prerequisites.cjs` returns `NO_GO` after window opened |
| V2 route smoke test failure | Critical flow (budget, account, transaction) returns 5xx or data-integrity error |
| Operator discretion | On-call lead decides to abort cutover for any reason |
| Owner revokes sign-off | Go/no-go approval withdrawn within 45 min of window |

**Do NOT execute** if:
- `ACTIVE_FINANCIAL_WRITE_VERSION` is already `V1` (no-op; verify with env-check).
- The rollback would violate the backup retention policy (see `restore-after-write.md`).

---

## 3. Pre-flight checklist (2 minutes)

```bash
# 1. Confirm current write version
echo $ACTIVE_FINANCIAL_WRITE_VERSION
# Expected: V2 (if already V1, stop — no rollback needed)

# 2. Confirm V1 is still healthy
curl -s http://localhost:3000/api/v1/health | jq .
# Expected: status == "ok"

# 3. Confirm no in-flight V2 writes
# Check app logs for "financial write authority is V2" + recent 4xx/5xx spike
tail -n 200 logs/api.log | grep "financial write authority"
```

If V1 is unhealthy, escalate to **restore-after-write.md** (§5 — emergency restore) instead.

---

## 4. Rollback steps

### Step 1: Flip feature flag back to V1 (1 minute)

```bash
# On hosting platform (Railway/Render/Fly.io) set env var:
ACTIVE_FINANCIAL_WRITE_VERSION=V1
DEPLOYMENT_ENV=production

# Redeploy / restart API workers. Wait for health check:
curl -s http://localhost:3000/api/v2/health | jq .
```

**Verify:**
```bash
node -e "console.log(require('./src/v2/infrastructure/cutover/writeAuthority.js').resolveWriteAuthority({activeFinancialWriteVersion:'V1',deploymentEnv:'production'}).isV2Writable)"
# Expected: false
```

### Step 2: Re-enable V1 write routes (idempotent)

No code change required — V1 routes continue serving writes as before. Confirm traffic is flowing:

```bash
curl -X POST http://localhost:3000/api/v1/transactions \
  -H "Authorization: Bearer $V1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"space_id":"<test-space>","amount":1000,"type":"income"}'
# Expected: 200 with transaction payload
```

### Step 3: Lock V2 write endpoints (defense-in-depth)

```bash
# Verify V2 endpoints reject writes post-rollback
curl -X POST http://localhost:3000/api/v2/transactions \
  -H "Authorization: Bearer $V2_TOKEN" \
  -d '{"space_id":"<test-space>","amount":1000,"type":"income"}'
# Expected: 403 / feature-flag reject (NOT 500, NOT silent success)
```

### Step 4: Snapshot for forensics (2 minutes)

```bash
# Capture current DB state timestamp
psql $POSTGRESQL_DIRECT_URL -c "SELECT now() AS rollback_timestamp;"

# Dump discrepancy_cases for post-mortem
psql $POSTGRESQL_DIRECT_URL -c "
  SELECT severity, status, count(*)
  FROM discrepancy_cases
  GROUP BY severity, status
  ORDER BY severity, status;
"
```

### Step 5: Notify stakeholders (parallel)

| Channel | Message |
|---|---|
| Slack #api-v2-cutover | `ROLLBACK INITIATED — write authority returned to V1. Cause: <reason>. ETA recovery: TBD.` |
| Email (owner + on-call) | Same as above + link to this runbook |
| PagerDuty | Acknowledge incident; attach runbook link |

---

## 5. Post-rollback validation

```bash
# Run the prerequisite checker in dry-run mode (no DB connection)
node scripts/verify-cutover-prerequisites.cjs --from-json ./snapshot-clean.json
# Expected: GO (or NO-GO with known failing gates — document them)

# Re-run Wave 7 baseline tests (sanity check V1 unaffected)
npx vitest run tests/unit/cutover/writeAuthority.test.js
# Expected: 8 tests PASS
```

---

## 6. Recovery path (when to retry cutover)

1. Root-cause the trigger (see §4 Step 4 forensics).
2. Fix in a new patch branch from `API_V2_ALT-wave_8`.
3. Re-run full Wave 8 entry gate (see `docs/v2/migration/wave-8-review.md`).
4. Re-schedule cutover window with owner + hypercare team.

**Do NOT re-open V2 writes** without:
- `verify-cutover-prerequisites.cjs` returning `GO`.
- Owner re-approval (go/no-go sign-off).
- Hypercare team standing by.

---

## 7. References

| Artifact | Path |
|---|---|
| Write authority module | `src/v2/infrastructure/cutover/writeAuthority.js` |
| Prerequisite checker | `src/v2/infrastructure/cutover/cutoverPrerequisites.js` |
| CLI script | `scripts/verify-cutover-prerequisites.cjs` |
| Master plan §16 | `docs/v2/migration/master-plan.md` |
| Decision register | `docs/v2/migration/decision-register.md` (DEC-003, DEC-025, DEC-026) |
| Restore runbook | `docs/v2/migration/runbooks/restore-after-write.md` |
