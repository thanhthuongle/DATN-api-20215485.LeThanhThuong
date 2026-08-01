# Execution Waves V2

## 1. Mục tiêu

Tài liệu này chia master plan thành các đợt triển khai có checkpoint. Phase vẫn là đơn vị kiến trúc/dependency trong `master-plan.md`; wave là đơn vị thực thi, staging release và nghiệm thu. Không thay thế hoặc đổi số phase hiện có.

Nguyên tắc:

- Mỗi thời điểm chỉ có một wave chính `IN_PROGRESS`.
- Trong wave nghiệp vụ, mỗi task chỉ xử lý một module hoặc 1-3 endpoint liên quan.
- Mỗi wave phải qua scope freeze, implementation, automated verification, staging/UAT và sign-off.
- V1 phải hoạt động sau mọi wave trước cutover.
- Financial write authority không được chia giữa V1/V2.
- Không chuyển wave khi dependency gate hoặc exit criteria chưa đạt.

## 2. Tổng quan

| Wave | Phạm vi phase | Kết quả chính |
|---|---|---|
| Wave 0 | Phase 0 | Inventory V1 và draft rules/matrices đầy đủ |
| Wave 1 | Phase 1-2 | API versioning, PostgreSQL/test/scheduler staging foundation |
| Wave 2 | Phase 3A-3D | PostgreSQL design freeze, Prisma migrations và approved posting templates |
| Wave 3 | Phase 4-4B | Financial kernel và periodic snapshot core |
| Wave 4A | Phase 5 | Identity và module nền tảng |
| Wave 4B | Phase 6 | Money sources/accounts/accumulations/savings accounts |
| Wave 4C | Phase 7 subset | Income, expense, transfer |
| Wave 4D | Phase 7 subset | Contribution, loan, borrowing, repayment, collection |
| Wave 4E | Phase 7 subset | Saving deposit, interest, maturity, close |
| Wave 5 | Phase 8-9 | Read models, reports, cache, notification và jobs |
| Wave 6 | Phase 10-10B | Full migration rehearsal và differential validation |
| Wave 7 | Phase 11 | Release candidate/UAT/security/DR sign-off |
| Wave 8 | Phase 12 | Production cutover và hypercare |
| Wave 9 | Phase 13-15 | Agenda upgrade/backend move và MongoDB retirement |

## 3. Wave 0 - Discovery và V1 behavior freeze

Chỉ thực hiện Phase 0: endpoint/collection/data-quality inventory, balance reconstruction, financial/job/side-effect/JWT/timezone/upload inventory, draft migration rules và posting/invariant matrix.

Exit:

- 100% endpoint, collection, financial mutation và scheduled job có owner/status.
- Mọi balance mismatch/data-quality class có count và rule owner.
- Không sửa kiến trúc V1 ngoài bug fix đã duyệt.

## 4. Wave 1 - API và staging foundation

Thứ tự:

1. Phase 1: mount URL cũ, `/api/v1`, `/api/v2`, API boundary và feature flags.
2. Phase 2: PostgreSQL local/Supabase staging, Prisma/test stack, scheduler abstraction, Agenda staging store riêng và observability baseline.

Exit: V1 vẫn chạy, V2 health/PostgreSQL staging hoạt động, database sạch dựng được, scheduler/Agenda isolation tests đạt; chưa triển khai business endpoint V2.

## 5. Wave 2 - PostgreSQL design freeze

Thứ tự bắt buộc:

```text
logical model -> physical table specification
-> financial invariant/posting templates
-> Prisma schema/migrations/seed -> dry run
```

Exit: 100% field có mapping decision, posting templates trong cutover scope `APPROVED`, schemas/roles/index/delete policy được review và clean migration/dry run đạt. Sau wave này mọi thay đổi schema đi qua versioned migration/review.

## 6. Wave 3 - Financial kernel

Thứ tự:

1. Explicit `TransactionContext` và database boundary.
2. Financial transactions/ledger/cached balance.
3. Idempotency/outbox/full reversal.
4. Internal discrepancy/reconciliation writer.
5. Periodic snapshot prerequisites/generator/rebuild.

Chỉ dùng fixture/internal runner; chưa di chuyển hàng loạt endpoint. Exit khi sample income/expense/transfer atomic, fail injection rollback, concurrency không double-spend/double-post và snapshot/reconciliation đạt.

## 7. Wave 4 - Vertical business slices

### Wave 4A - Foundation modules

Thứ tự ưu tiên: users/auth/session, financial spaces/membership, banks/categories, families/contacts, Admin Operations API/UI foundation và notifications cơ bản.

### Wave 4B - Sources/accounts

Triển khai tuần tự: money sources -> normal accounts -> accumulations -> savings accounts. Mỗi slice gồm contract, API/controller, service/policy, repository, ledger/opening transaction khi cần, tests và staging flag.

### Wave 4C - Basic financial commands

Income -> expense -> transfer. Mỗi loại là một slice độc lập và phải kiểm chứng core, system accounts, insufficient balance, locking, idempotency, reversal, assets và outbox.

### Wave 4D - Debt/advanced commands

Loan + repayment -> borrowing + collection -> contribution. Không bắt đầu flow nếu posting template/rate basis liên quan chưa approved.

### Wave 4E - Time-based savings

Saving deposit -> interest -> maturity -> close. Wave riêng vì phụ thuộc UTC/day-count, scheduled financial jobs, idempotency và missed-run catch-up.

Mỗi sub-wave có staging release/sign-off riêng; không đánh dấu toàn Phase 7 hoàn tất khi còn transaction type chưa đạt exit criteria.

## 8. Wave 5 - Read models và operations

Phase 8 trước Phase 9: query/report/execution plan/index, sau đó budget/cache/outbox consumers/notification/jobs/snapshot schedule và production Agenda-store transition rehearsal.

Exit: reports đúng/đạt threshold, cache nhất quán, job retry không tạo tiền/snapshot trùng, side effects cô lập và Agenda credential không thể ghi business collections.

## 9. Wave 6 - Migration và differential validation

1. Phase 10: deterministic full-reload pipeline, legacy balance remediation/anchors và tối thiểu ba rehearsal trong maintenance budget.
2. Phase 10B: offline replay, shadow read/captured-command replay, V1/V2 performance/hot-account comparison và restore rehearsal.

Entry Phase 10B yêu cầu đóng `OPEN-005`. Exit yêu cầu `0 BLOCKING` discrepancy, critical flows/endpoints có result hoặc approved exception và production-like restore đạt RPO/RTO.

## 10. Wave 7 - Release candidate

Phase 11 feature freeze: chỉ UAT, OpenAPI/security/IDOR/concurrency/load tests, cutover/rollback-before-write/restore-after-write rehearsal, observability/flags/DR sign-off và blocking bug fixes. Không thêm feature hoặc refactor lớn.

## 11. Wave 8 - Cutover

Thực hiện Phase 12 đúng runbook:

```text
maintenance -> freeze/drain V1 -> source backup/manifest
-> clean full migration -> reconcile/smoke/go-no-go
-> force logout/switch write authority -> open V2 -> hypercare
```

Không triển khai feature trong maintenance/hypercare ngoài forward-fix bắt buộc.

## 12. Wave 9 - Post-cutover retirement

Ba release độc lập:

1. Phase 13: Agenda 5 -> 6, vẫn MongoDB backend.
2. Phase 14: Agenda 6 MongoDB -> PostgreSQL backend.
3. Phase 15: observation/backup/audit xong mới retire MongoDB.

Không nâng Agenda major version và đổi backend trong cùng release.

## 13. Workflow mỗi wave

```text
scope freeze -> task breakdown -> implementation
-> automated verification -> staging deploy/UAT
-> metrics/evidence review -> READY_FOR_REVIEW -> sign-off/COMPLETED
```

Wave không hoàn tất nếu test bắt buộc chưa chạy, còn blocking discrepancy, tài liệu/progress chưa cập nhật, không có staging evidence hoặc exit criteria chưa đạt.

## 14. Cách giao task cho Codex

Không giao toàn phase/wave trong một prompt. Mẫu:

```text
Wave/Task: <ví dụ Wave 3 / TC-01 TransactionContext>

Scope:
- Một module hoặc 1-3 endpoint.
- File/thư mục được phép sửa.
- Không sửa V1 ngoài scope.

Requirements:
- Contract/invariant/decision IDs liên quan.
- Financial writes qua core/TransactionContext.
- Ownership, idempotency, rollback và side effects.

Verification:
- Lint + unit/integration/contract/concurrency tests phù hợp.
- Review diff và V1 regression.
- Cập nhật progress/evidence.
```

Chỉ mở task tiếp theo sau khi task hiện tại có diff/test review. Parallel work chỉ dành cho artefacts thật sự độc lập; không song song hóa các thay đổi cùng chạm schema/transaction core/posting template.

## 15. Ước lượng

Không chốt lịch cố định trước Wave 0. Sau inventory, ước lượng từng wave bằng số module/endpoints/flows, data-quality classes và rehearsal time; cập nhật forecast sau mỗi wave dựa trên số liệu thực tế.
