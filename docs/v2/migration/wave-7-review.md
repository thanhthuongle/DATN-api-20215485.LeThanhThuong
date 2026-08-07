# Wave 7 Review — Phase 11 (Release Candidate / Security Gate)

Ngày: 2026-08-07. Branch: `API_V2_ALT-wave_7`.
Phạm vi được phép: chỉnh sửa trên api v2 (`src/v2`, `src/api/v2`, `tests`, `docs/v2`).
Không sửa api v1. V1 phải duy trì hoạt động như cũ.

## 1. Entry gate

- Wave 6 đã merge (PR #85). Wave 7 đang `NOT_STARTED` theo `progress.md`.
- Các issue critical còn mở từ Wave 6 trên `progress.md`: P0 auth admin endpoints, P1 thiếu integration tests, P2 `reconciliationEngine` BIGINT type-safety — các issue này trở thành "blocking bug fixes" trong Phase 11 (feature freeze).
- Working tree trước khi bắt đầu: `CLAUDE.md` (modified) và `AGENTS.md` (untracked) là thay đổi user pre-existing (GitNexus integration) — đã giữ nguyên, không xoá/ghi đè.
- GitNexus index fresh (cùng commit HEAD).
- Environment: Node v22.22.0, Vitest 4.1.10, Prisma 7.9.1; `node_modules`/eslint/babel có sẵn.

## 2. Phạm vi đã triển khai (Phase 11 — security hardening + blocking fixes)

### 2.1 Fix P0 migration admin auth + admin authorization guard
| File | Loại | Nội dung |
|---|---|---|
| `src/api/v2/middlewares/adminAuth.js` | mới | `adminAuthMiddleware.isAdmin` — deny-by-default guard (403 production cho non-admin; warn dev/staging khi thiếu role infra). |
| `src/api/v2/routes/migrationRoute.js` | sửa | Thêm `authMiddleware.isAuthorized` + `adminAuthMiddleware.isAdmin` cho cả 4 admin endpoints. |

> Note: `migrationRoute.js` đã có `authMiddleware.isAuthorized` tại thời điểm review (đã được thêm sau khi `progress.md` ghi P0). Wave 7 xác nhận auth hiện diện và bổ sung admin guard theo `admin-operations.md` §5.

### 2.2 Auth cho budget/notification (W5-02 — defer từ Wave 5)
| File | Loại | Nội dung |
|---|---|---|
| `src/api/v2/routes/budgetRoute.js` | sửa | Thêm `authMiddleware.isAuthorized` cho GET/POST budgets. |
| `src/api/v2/routes/notificationRoute.js` | sửa | Thêm `authMiddleware.isAuthorized` cho GET list + PUT mark-read. |

### 2.3 Fix P2 reconciliation BIGINT type-safety
| File | Loại | Nội dung |
## 3. Verification đã chạy (thực tế)
| Check | Kết quả |
|---|---|
| `npx prisma validate` | PASS |
| `npx vitest run tests/unit` | 31 files / 223 tests PASS |
| `npx vitest run tests/unit/adminAuth.test.js` + `reconciliationEngine.service.test.js` | 2 files / 11 tests PASS |
| `npx vitest run tests/contract/v2SecurityAuth.test.js` | 6 tests PASS |
| `node --check` các file mới/sửa | PASS |
| `npx eslint` trên file thay đổi | PASS (0 error / 0 warning) |
| `npx babel` compile `adminAuth.js` | PASS |
| `npx prisma generate` | PASS |
| Integration tests (Docker/Testcontainers) | BLOCKED / N/A — môi trường không chạy Docker; không tuyên bố pass |

## 4. Findings & triage
| ID | Mức | File | Finding | Trạng thái |
|---|---|---|---|---|
| W7-01 | P1 | adminAuth | `isAdmin` chỉ 403 trong production; dev/staging cho non-admin qua (chỉ warn) — không deny-by-default tuyệt đối. | **DEFER** — thiếu admin-role issuance path; dùng feature gate + role lookup trước cutover (Wave 8). |
| W7-02 | P1 | toàn bộ V2 routes | Money-movement + read routes (income/expense/transfer/loan/borrowing/repayment/collection/contribution/account + query/space/category/contact/bank) chưa có auth. Không exploitable production (sau feature flag, V1 là write authority). | **DEFER** — P1 mở, owner = pre-cutover security/auth gate (Wave 8), theo quyết định user 2026-08-07 (Option 1). |
| W7-03 | P2 | authMiddleware/adminAuth | `role` từ `jwtDecoded` không qua lookup/issuance — brittle. | **DEFER** — cùng owner Wave 8 (role resolution server-side). |
| W7-04 | P2 | query/notification service | Thiếu ownership/IDOR check ràng buộc resource với `req.jwtDecoded`. | **DEFER** — cùng owner Wave 8 (IDOR tests mọi resource có ownership). |
| W7-05 | P3 | reconciliationEngine | null → 0n có thể che missing aggregate row. | **ACCEPT** — low risk, hợp lệ fallback. |

### Route auth inventory (V2)
| Route file | Auth |
|---|---|
| healthRoute | none (ok) |
| bankRoute / categoryRoute / contactRoute / spaceRoute / accountRoute | none — **DEFER W7-02** |
| budgetRoute / notificationRoute | **auth (Wave 7)** |
| queryRoute / incomeRoute / expenseRoute / transferRoute / loanRoute / borrowingRoute / repaymentRoute / collectionRoute / contributionRoute | none — **DEFER W7-02** |
| migrationRoute | **auth + admin (Wave 7)** |

## 5. Defer / ngoài slice (owner một cách rõ ràng)
- Broadcast auth + ownership/IDOR cho toàn bộ V2 route còn thiếu → **P1 deferred, owner = pre-cutover security/auth gate (Wave 8)** theo user decision 2026-08-07.
- Admin-role issuance path + role lookup server-side → Wave 8.
- UAT, load/concurrency tests, cutover rehearsal, DR restore drill → phụ thuộc staging/prod infra, theo master-plan Phase 11 incomplete; ghi nhận như gates cần môi trường (không phải CODE_FAILURE).

## 6. Đánh giá cuối
**COMPLETED** (project owner sign-off 2026-08-07). Phase security hardening trong phạm vi Phase 11 (feature freeze) đã: fix P0 admin auth guard, resolve W5-02 (budget/notification auth), fix P2 BIGINT type-safety, bổ sung security contract tests. V1 không bị sửa (không có file `src/middlewares/*`, `src/services/*`, `src/models/*`, `src/routes/*` thay đổi; chỉ import middleware V1 sẵn có). Các finding P1/P2 broad auth được defer rõ ràng sang Wave 8 với owner + evidence, theo quyết định user. Các gates cần môi trường (UAT/load/DR) ghi nhận là BLOCKED-by-environment, không giả vờ pass.

|---|---|---|
| `src/v2/modules/migration/services/reconciliationEngine.service.js` | sửa | `asBigInt` coerce an toàn: bigint/string/number/null — null → 0n (không throw, không false-flag). |
| `tests/unit/migration/reconciliationEngine.service.test.js` | sửa | +2 regression tests (string BIGINT từ pg adapter; null net không throw). |

### 2.4 Security contract tests
| File | Loại | Nội dung |
|---|---|---|
| `tests/unit/adminAuth.test.js` | mới | 4 tests: thiếu session → 401; admin pass; non-admin production → 403; non-admin dev → warn+pass. |
| `tests/contract/v2SecurityAuth.test.js` | mới | 6 tests HTTP boundary: budget + notification + migration admin đều 401 khi không có token. |
