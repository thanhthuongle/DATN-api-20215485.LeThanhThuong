# Master Plan: MongoDB V1 -> PostgreSQL V2

## 1. Mục tiêu và phạm vi

Xây API V2 trên PostgreSQL mà không làm gián đoạn V1 production. V2 giữ endpoint gần tương ứng V1, tách implementation và bổ sung transaction core, ledger, snapshot, idempotency, outbox và reconciliation.

## 2. Nguyên tắc thực thi

Mỗi phase đi qua quy trình:

```text
phân tích -> cập nhật tài liệu -> triển khai phạm vi nhỏ
-> test -> review -> cập nhật progress -> checkpoint/commit
```

- Không bắt đầu phase phụ thuộc khi phase trước chưa đạt exit criteria.
- Không trộn migration database với refactor không cần thiết hoặc chuyển TypeScript.
- Mỗi task chỉ xử lý một module hoặc một nhóm nhỏ endpoint liên quan.
- V1 phải tiếp tục hoạt động sau mọi phase trước cutover.
- Mọi luồng tiền phải được review về atomicity, locking, idempotency, authorization và rollback.
- Mỗi phase phải ghi số đo thực tế và evidence trong progress; không đánh dấu hoàn thành chỉ bằng cảm nhận.
- Feature flag không thay đổi nguyên tắc single write authority: tại một thời điểm financial write chỉ thuộc V1 hoặc V2.
- `src/api/v2` là HTTP layer; `src/v2` không phụ thuộc Express request/response và chỉ chứa business/core/infrastructure.
- Financial write repositories/raw SQL luôn dùng explicit transaction context; không dùng global Prisma client.
- Các phase được thực thi theo waves trong `docs/v2/migration/execution-waves.md`; không chạy toàn bộ plan trong một đợt.
- Mỗi thời điểm chỉ một wave chính active; Phase 5-7 được chia thành vertical slices và staging sign-off riêng.

### Acceptance metrics theo phase

| Phase | Chỉ số nghiệm thu tối thiểu |
|---|---|
| 0 | 100% endpoint, collection, balance mutation và scheduled job được inventory, có owner/status; mọi vấn đề dữ liệu có count và rule owner |
| 1 | 100% legacy routes vẫn mount và vượt smoke/contract baseline; API boundary/OpenAPI baseline có owner; V2 flag mặc định tắt ngoài staging |
| 2 | Local stack health thành công; database rỗng dựng được từ migration/seed; scheduler contract, Agenda store và staging isolation tests vượt qua |
| 3 | 100% field có mapping decision; 100% financial flow có invariant/posting template được duyệt; auth/discrepancy/idempotency/outbox/asset schemas và clean migration vượt qua |
| 4/4B | 0 invariant violation, duplicate posting hoặc lost update trong test matrix; toàn bộ failure point rollback đúng; snapshot chain/checksum hợp lệ |
| 5-9 | 100% endpoint/job thuộc module đã công bố hoàn tất có contract/integration test và feature flag/owner rõ ràng |
| 10 | Tối thiểu 3 full-reload rehearsal liên tiếp cùng source snapshot cho counts/totals/checksum nhất quán và nằm trong maintenance budget; 0 discrepancy `BLOCKING` |
| 10B | 100% critical financial flows và endpoint trong cutover scope được differential validate hoặc có approved exception; 0 mismatch tài chính chưa phân loại |
| 11 | Security/UAT đạt; performance threshold được chốt từ V1 baseline và tải dự kiến, sau đó V2 đạt threshold đó |
| 12 | 100% go/no-go checklist đạt, 0 blocking discrepancy và smoke test critical flows thành công trong maintenance budget |
| 13-15 | Theo exit criteria và observation metrics trong `operations/agenda-retirement.md` |

Số liệu chi tiết có thể chặt hơn sau Phase 0. Không được hạ tiêu chí integrity để đạt KPI hiệu năng.

## 3. Phase 0 - Inventory và đóng băng V1

### Công việc

- Liệt kê routes, methods, middleware và controller/service/model liên quan.
- Ghi request, response và error contract của từng endpoint.
- Liệt kê collections, fields, embedded arrays và quan hệ ObjectId.
- Profile kiểu dữ liệu thực tế, missing/null, duplicate, orphan và giá trị ngoài validation hiện tại.
- Liệt kê aggregation pipelines và truy vấn báo cáo.
- Liệt kê mọi vị trí tăng/giảm/set balance.
- Ghi rõ balance policy thực tế của từng loại account và các ngoại lệ dữ liệu V1.
- Inventory mọi phép tính ngày/timezone và xác nhận quy ước UTC của hệ thống.
- Inventory mọi hard-coded timezone compensation như `.add(7, 'hours')`; phân loại financial time và user reminder time.
- Liệt kê scheduled jobs, cache và external side effects.
- Inventory JWT/access-refresh token/Socket ID claims, frontend cached ObjectIds và force-logout impact.
- Inventory Cloudinary/file flows, orphan assets và side effect xảy ra trước/sau database write.
- Reconstruct balance từ V1 transaction history và lập report so với stored account balance.
- Lập draft financial invariant/posting matrix từ bằng chứng V1 và nhận diện flow chưa rõ.
- Lập draft migration rule catalog cho embedded documents, array references, ObjectId, orphan, duplicate và invalid legacy data.
- Xác nhận endpoint frontend đang sử dụng.
- Thiết lập nguyên tắc feature freeze V1.

### Đầu ra

```text
docs/v2/migration/endpoint-inventory.md
docs/v2/database/mongodb-inventory.md
docs/v2/migration/financial-flows.md
docs/v2/migration/financial-invariant-matrix.md
docs/v2/migration/background-jobs.md
docs/v2/migration/data-migration-strategy.md
docs/v2/migration/final-migration-strategy.md
docs/v2/migration/identity-auth-inventory.md
docs/v2/database/data-quality-report.md
```

### Exit criteria

- Mỗi endpoint có owner module và dependency rõ ràng.
- Mỗi balance mutation và scheduled financial flow được nhận diện.
- Không còn collection hoặc aggregation chưa phân loại.
- Mỗi data quality issue có count, ví dụ record và hướng xử lý dự kiến.
- 100% financial mutation/job có một dòng trong draft invariant/posting matrix hoặc quyết định archive/deprecate.
- JWT/Socket/ObjectId compatibility, timezone compensations, upload side effects và legacy balance mismatches có count/rule owner.

## 4. Phase 1 - API versioning

### Công việc

- Tạo `src/api/v1` và đưa/re-export routes hiện tại vào V1.
- Mount V1 tại URL cũ và `/api/v1`.
- Tạo router V2 dưới `/api/v2`.
- Giữ routes/controllers/Joi/API mappers trong `src/api/v2`; business services/repositories/policies nằm trong `src/v2`.
- Thêm cấu hình bật V2 theo môi trường.
- Tạo registry feature flag theo module; tất cả V2 write flags mặc định tắt ở production.
- Thêm health endpoint cho từng version khi phù hợp.
- Tạo OpenAPI V1 baseline skeleton và approved-difference registry; controller không gọi Prisma/Redis/Agenda.

### Exit criteria

- URL cũ không thay đổi hành vi.
- `/api/v1` tương đương URL cũ.
- V2 chỉ được bật trên staging.
- Chưa thay đổi MongoDB controller/service/model trong phase này ngoài import cần thiết.
- Boundary test/lint rule chứng minh `src/v2` không import Express và V2 controller không import database infrastructure.

## 5. Phase 2 - PostgreSQL staging foundation

### Công việc

- Mở rộng `docker-compose.dev.yml` hiện có: giữ Redis, thêm PostgreSQL và profile dependency local cần thiết thay vì tạo stack rời; dùng Supabase PostgreSQL cho staging.
- Cấu hình `DATABASE_URL` và database test riêng.
- Cài Prisma, tạo client singleton, migration/seed commands và health check.
- Cô lập Redis namespace, jobs, email, socket và notification staging.
- Giữ Agenda 5 với MongoDB job storage; V2 staging không dùng chung job collection/worker với production.
- Tách staging Agenda store bằng `AGENDA_MONGODB_URI/DATABASE_NAME/COLLECTION` và credential riêng khỏi business MongoDB.
- Cấu hình Prisma với Supabase connection mode phù hợp môi trường chạy và tách credential staging.
- Thiết lập Node.js 20+, Vitest, Supertest và disposable PostgreSQL/MongoDB/Redis test infrastructure theo `docs/v2/testing/strategy.md`.
- Xây `JobScheduler` contract, `Agenda5MongoScheduler` adapter và job registry theo `docs/v2/architecture/job-scheduler.md`.
- Giữ vai trò rõ ràng: scheduler dispatch, handler điều phối, service/core xử lý nghiệp vụ.
- Thiết lập feature flag source/audit/cache convention và observability baseline theo `operations/production-readiness.md`.

### Exit criteria

- Có thể dựng database rỗng bằng migrations và seed.
- V1 MongoDB vẫn khởi động bình thường.
- V2 kết nối PostgreSQL staging độc lập.
- Scheduler contract/graceful shutdown/stable-key tests vượt qua và business service mẫu không import Agenda.
- Agenda staging credential không thể ghi business collections; job store/worker không dùng chung production.
- Docker Compose local và Testcontainers dùng chung version/config convention nhưng có lifecycle độc lập.

## 6. Phase 3 - PostgreSQL data model

### Phase 3A - Logical data model

- Mapping collections/fields sang tables/columns.
- Chuẩn hóa arrays và embedded documents.
- Thiết kế users, families, financial spaces và membership.
- Thiết kế accounts, savings, accumulations, budgets và debts.
- Thiết kế financial transactions, ledger, snapshots, idempotency và outbox.
- Thiết kế refresh sessions/token families, discrepancy/admin audit, feature flags và temporary asset/attachments.
- Thiết kế system account `MIGRATION_EQUITY` và provenance cho audited migration anchors.

### Phase 3B - Physical table specification

- Đặc tả từng column: PostgreSQL type, nullability, default và MongoDB source.
- Định nghĩa PK, FK, unique constraints, indexes và delete policies.
- Ghi migration rule cho từng field: migrate, transform, archive hoặc drop kèm lý do.
- Ghi query/index mapping và lifecycle/status của từng bảng.
- Áp dụng quy tắc lãi suất trong `docs/v2/database/interest-rate-rules.md`.
- Áp dụng bộ ba internal BIGINT identity, public UUID và nullable legacy Mongo ID; money VND phải serialize dạng string ở API.
- Hoàn thiện migration rule catalog và dependency graph theo `data-migration-strategy.md`.
- Đặc tả transaction state/full reversal, permanent idempotency tombstone, outbox ordering/lease/version và discrepancy state/version.
- Định nghĩa database roles, soft-delete/RESTRICT cho entities có ledger history và audit immutability.

### Phase 3B2 - Financial invariants và posting templates

- Hoàn thiện `financial-invariant-matrix.md` từ inventory V1.
- Chốt postings, account roles/system accounts, preconditions, authorization, balance rule, lock order, business snapshot, reversal, idempotency và legacy migration rule cho từng flow.
- Chuyển từng invariant thành danh sách unit/integration/concurrency/failure tests.

### Phase 3C - Prisma schema và migrations

- Tạo Prisma schema từ physical specification đã review.
- Tạo migration sạch và seed dữ liệu hệ thống.
- Không dùng Prisma schema để thay thế table specification.

### Phase 3D - Data profiling dry run

- Chạy transform/load thử trên bản sao dữ liệu staging.
- Báo cáo missing values, orphan IDs, duplicate relations, invalid rates và balance mismatch.
- Mọi record bị reject phải có remediation rule; không bỏ qua âm thầm.

### Đầu ra

```text
docs/v2/database/mongodb-postgresql-mapping.md
docs/v2/database/logical-data-model.md
docs/v2/database/postgresql-data-model.md
docs/v2/database/postgresql-table-specification.md
docs/v2/database/ledger-schema.md
docs/v2/database/data-quality-report.md
docs/v2/database/auth-session-schema.md
docs/v2/database/discrepancy-audit-schema.md
docs/v2/database/outbox-idempotency-schema.md
docs/v2/database/asset-attachment-schema.md
docs/v2/migration/financial-invariant-matrix.md
docs/v2/migration/migration-rule-catalog.md
docs/v2/migration/load-dependency-graph.md
docs/v2/migration/reconciliation-specification.md
prisma/schema.prisma
```

### Exit criteria

- Schema được review về integrity, ownership và query patterns.
- Amount/balance không dùng floating point.
- Không còn quan hệ đa hình/array ID không có chiến lược rõ ràng.
- 100% field có quyết định migrate, transform, archive hoặc drop kèm lý do.
- Mọi foreign key có delete policy và mọi query trọng yếu có index plan.
- Interest fields tuân theo DEC-021 và dữ liệu legacy có rate basis rõ ràng hoặc `UNSPECIFIED`.
- Dry run không còn lỗi chưa được phân loại.
- Prisma schema validate và migration sạch chạy thành công.
- 100% financial flow trong inventory có posting template `APPROVED`; không còn dòng `TBD/DRAFT` trong cutover scope.
- Session/discrepancy/outbox/idempotency/asset schemas và database roles có migrations/constraints/indexes đã review.

## 7. Phase 4 - Transaction core

### Entry gate

Phase 4 chỉ bắt đầu khi financial invariant/posting template matrix đã đạt tiêu chí duyệt của Phase 3. Transaction core không nhận postings tùy ý từ module service; nó thực thi template/type đã đăng ký.

### Công việc

- Xây financial transaction orchestration.
- Xây transaction manager/context; mọi financial repository/raw SQL nhận cùng Prisma transaction client.
- Xây ledger postings và cached balance projection.
- Thêm idempotency, deterministic locking, snapshots, reversal và outbox.
- Xây reconciliation service/job.
- Xây full reversal transaction; V2 ban đầu không hỗ trợ partial reversal.
- Xây idempotency claim/recovery và outbox worker lease/ordering/unknown-delivery handling.
- Xây internal discrepancy/audit writer; Admin API chưa mở ở phase này.
- Enforce balanced postings tại database boundary và áp dụng locking/retry/idempotency/outbox trong `implementation-guardrails.md`.
- Viết unit, integration, rollback và concurrency tests.

### Exit criteria

- Income, expense và transfer mẫu chạy atomic.
- Retry không double-post.
- Concurrent spending không làm âm hoặc sai balance ngoài rule.
- Failure ở ledger/immutable business snapshot/outbox rollback toàn bộ.
- Reversal và reconciliation được kiểm thử.
- Fail injection chứng minh không financial repository nào commit ngoài transaction context.
- Concurrent idempotency, crash-after-commit, outbox provider-success-before-ack và reversal lần hai được kiểm thử.

### Phase 4B - Periodic balance snapshot core

#### Công việc

- Bổ sung account entry sequence và `posted_at` bất biến cho ledger entries.
- Tạo bảng daily balance snapshots và snapshot run/audit metadata.
- Xây snapshot generator theo business date UTC, account lock và sequence high-watermark.
- Xây snapshot chain: opening balance của ngày sau phải bằng closing balance ngày trước.
- Tính inflow, outflow, closing balance, entry count, cutoff sequence và entry-chain checksum.
- Lưu version/history; rebuild tạo version mới, không ghi đè checkpoint cũ.
- Bổ sung explicit cutoff fields/current/superseded state và account open/close lifecycle; accounting snapshot không dùng user timezone.
- Hỗ trợ ngày không có giao dịch bằng carry-forward snapshot.
- Xây idempotent upsert, retry và rebuild theo account/date range.
- Mở rộng reconciliation để kiểm tra snapshot với ledger và cached balance.
- Viết unit, integration, timezone, retry, concurrency và corruption tests.

Job tự động chưa được nối vào Agenda trong Phase 4B; generator được gọi trực tiếp từ test/admin runner. Agenda integration thuộc Phase 9.

#### Exit criteria

- Cùng account/business date chạy nhiều lần chỉ có một snapshot hợp lệ.
- Snapshot chain liên tục và closing balance khớp ledger tại cutoff.
- Giao dịch backdated không viết lại snapshot cũ vì checkpoint dựa trên `posted_at`.
- Reversal xuất hiện ở checkpoint của ngày reversal được post.
- Rebuild có audit log và không sửa ledger entries.
- Lỗi snapshot không làm rollback hoặc thay đổi financial transaction đã commit trước đó.
- Chi tiết trong `docs/v2/architecture/periodic-balance-snapshots.md` được kiểm thử đầy đủ.

## 8. Phase 5 - Module nền tảng

### Thứ tự

1. Banks.
2. Users, authentication, V2 session, refresh rotation/revocation và UUID token claims.
3. Families và membership.
4. Financial spaces.
5. Categories.
6. Contacts.
7. Notifications cơ bản.
8. Admin Operations API, discrepancy queue và audit foundation.

### Quy trình mỗi endpoint

```text
copy contract V1 -> V2 route -> V2 controller -> V2 service
-> PostgreSQL repository -> mapper -> contract/integration tests
```

Mỗi module có feature flag riêng trên staging. Chỉ công bố module hoàn tất khi toàn bộ dependency, contract và authorization tests của module đạt; flag không cho phép module tài chính ghi chéo V1/V2.

### Exit criteria

- V2 không import MongoDB model.
- Authorization/IDOR được kiểm thử.
- Response tương thích V1 hoặc khác biệt được tài liệu hóa.
- CSRF/CORS mode, rate limit, session revoke/reuse và HTTP/Socket UUID subject được integration/security test.
- Admin reversal/adjustment yêu cầu step-up auth và audit.

## 9. Phase 6 - Nguồn tiền

### Thứ tự

1. Money sources.
2. Accounts.
3. Accumulations.
4. Savings accounts.

### Quy tắc

- Tạo ledger account cùng account nghiệp vụ.
- Opening balance phải là financial transaction.
- Không lưu `transactionIds[]`; truy vấn qua relation/ledger.
- Block, close, deposit và withdrawal tuân theo transaction core.

### Exit criteria

- Không có service/repository ngoài core cập nhật balance.
- Ownership cá nhân/gia đình và trạng thái account được kiểm thử.

## 10. Phase 7 - Transaction endpoints

### Thứ tự

1. Income.
2. Expense.
3. Transfer.
4. Contribution.
5. Loan.
6. Borrowing.
7. Repayment.
8. Collection.
9. Saving deposit, interest, maturity và close.

Mỗi loại phải mô tả account nguồn/đích, system account, quyền actor, balance rule, snapshot, reversal và idempotency scope. Implementation phải tham chiếu đúng posting template đã duyệt; thay đổi template phải review lại invariant và migration impact.

Financial endpoints có attachment dùng temporary asset ID; Cloudinary không được gọi trong PostgreSQL transaction, orphan cleanup/finalize chạy bằng outbox/job.

### Exit criteria

- Tất cả financial endpoint gọi transaction core.
- Có tests cho rollback, retry, insufficient balance và concurrency phù hợp.
- Upload success/DB failure, cleanup race và retry không tạo asset/attachment trùng.

## 11. Phase 8 - Query, aggregation và báo cáo

### Công việc

- Viết lại transaction lists/details/recent queries.
- Viết lại money source summary, budget spending, debt/saving reports.
- Dùng Prisma cho query thông thường và parameterized TypedSQL/raw SQL cho query phức tạp.
- Kiểm tra execution plan và thêm index theo dữ liệu staging.

### Exit criteria

- Không có unsafe dynamic SQL.
- Query trọng yếu đạt yêu cầu đúng dữ liệu và hiệu năng đã xác định.

## 12. Phase 9 - Budget, cache, notification và jobs

### Công việc

- Chuẩn hóa budget categories và tính spent từ transaction data.
- Tách cache keys V1/V2 và chỉ invalidate sau commit.
- Giữ Agenda 5 và MongoDB làm job storage trong lần cutover V2; chuyển job handlers tài chính sang gọi V2 service/transaction core.
- Production Agenda store/credential phải được chuyển sang database riêng trước cutover: drain old workers và reschedule bằng stable business keys, không copy lock state.
- Nối daily balance snapshot scheduler vào Agenda 5; Agenda chỉ kích hoạt snapshot service, không chứa logic tính balance.
- Mọi job tác động tiền gọi transaction core với idempotency key ổn định.
- Mọi job V2 đăng ký qua `JobScheduler`; handler/service không import Agenda và job registry phải bao phủ 100% scheduled flows.
- Financial jobs dùng UTC. Reminder/notification nhận validated IANA timezone từ user profile, quy đổi local target thành UTC `runAt` và reschedule khi timezone thay đổi.
- Xử lý notification/email/socket qua outbox sau commit.

Sau khi V2 production ổn định, thực hiện hai bước độc lập: nâng Agenda 5 lên Agenda 6 với MongoDB backend, sau đó mới chuyển Agenda 6 sang PostgreSQL backend.

### Exit criteria

- Job retry không tạo tiền/giao dịch trùng.
- Snapshot job retry không tạo snapshot trùng và có thể catch up ngày bị bỏ lỡ.
- Cache không trả dữ liệu chéo version hoặc sai sau transaction.
- Side effects staging được cô lập.
- Agenda credential không thể ghi business collections; chỉ một store/worker fleet dispatch và job inventory đối soát đầy đủ.
- Không còn hard-coded timezone compensation `.add(7, 'hours')` trong V2 jobs.

## 13. Phase 10 - Data migration pipeline

### Pipeline

```text
global freeze/drain -> source manifest/backup -> full extract
-> transform -> clean load -> reconcile -> report
```

### Yêu cầu

- Script chạy lại không tạo dữ liệu trùng.
- Giữ mapping ObjectId.
- Chuyển lịch sử tiền sang ledger bằng posting template đã duyệt; không tạo adjustment im lặng để ép balance khớp.
- Hỗ trợ batch, checkpoint/resume và dead-letter report.
- Load bảng cha trước bảng con.
- Đối soát counts, totals, balances, debts, savings, foreign keys và ledger.
- Mọi reject/mismatch được lưu thành discrepancy case có evidence, severity và hướng xử lý.
- Áp dụng rule catalog riêng cho embedded document, array reference, ObjectId/FK, orphan, duplicate và invalid legacy data.
- Mỗi run lưu source snapshot/checksum, code/schema version, batch checkpoints, counts/totals và reject manifest.
- Final cutover dùng full reload vào PostgreSQL sạch; không dùng ObjectId/`updatedAt` làm incremental watermark.
- So reconstructed history với V1 stored balance, tolerance `0 VND`; mismatch là `BLOCKING`.
- Chỉ cho phép explicit migration anchor đối ứng `MIGRATION_EQUITY` khi có discrepancy/evidence/approval.

### Exit criteria

- Migration rehearsal hoàn thành nhiều lần trên staging snapshot.
- Tối thiểu 3 rehearsal liên tiếp trên cùng source snapshot cho kết quả reconciliation nhất quán.
- Ba rehearsal xác nhận full reload + reconciliation + smoke test nằm trong maintenance budget; nếu không đạt phải mở decision incremental/change-journal riêng.
- Không có orphan hoặc unbalanced transaction.
- Không còn discrepancy `BLOCKING`; mọi case cần review có quyết định và audit.
- Mọi record bị loại đều có báo cáo và quyết định xử lý.

## 14. Phase 10B - Differential replay và shadow validation

### Entry gate

PostgreSQL production hosting/connection mode, RPO/RTO, PITR/backup retention và restore procedure đã được chốt. Không bắt đầu Phase 10B nếu `OPEN-005` chưa đóng.

### Công việc

- Chạy offline differential replay V1/V2 trên cùng fixture/source snapshot.
- Chạy shadow read cho read models không side effect và captured-command replay vào staging resettable.
- Canonicalize UUID, timestamp động và thứ tự không có ý nghĩa trước khi diff.
- So sánh contract, authorization, normalized errors, ledger, balance, interest, report và job intent.
- Lưu mismatch thành discrepancy case và quản lý intentional difference bằng approved-difference registry.
- Đo V1 baseline/V2 latency-throughput để đề xuất performance threshold cho Phase 11.
- Chạy hot-account contention và connection-pooling mode tương đương production.

Không live shadow-write production, không dispatch external side effects và không cho PostgreSQL staging trở thành write authority của production. Chi tiết nằm trong `docs/v2/migration/shadow-validation.md`.

### Exit criteria

- 100% critical financial flows có success/failure replay; endpoint trong cutover scope có result hoặc approved exception.
- Không còn ledger/balance/authorization mismatch chưa phân loại và không còn discrepancy `BLOCKING`.
- Replay lặp lại được, không tạo side effect ngoài staging; báo cáo baseline/performance được lưu.
- Restore rehearsal trên production-like PostgreSQL đạt RPO/RTO và ledger/balance/outbox/jobs reconciliation.

## 15. Phase 11 - Parity, UAT và security review

### Kiểm thử

- Contract parity V1/V2 trên cùng fixtures.
- Integration và financial invariant tests.
- Concurrency, authorization/IDOR và failure-injection tests.
- Performance, cache, jobs và migration rehearsal.
- OpenAPI implementation validation, JWT force-logout/UUID migration, refresh rotation, CSRF/CORS, admin step-up auth và database role tests.
- Observability/alert/runbook, feature flag/write-authority và disaster-recovery rehearsal.
- Diễn tập rollback trước khi mở V2 writes và restore/forward-fix sau khi đã mở writes.

### Exit criteria

- Không có ledger hoặc balance mismatch.
- Endpoint trọng yếu đạt parity hoặc khác biệt đã được chấp nhận.
- Security review, UAT và rollback rehearsal đạt yêu cầu.
- V2 đạt performance threshold đã chốt từ baseline V1 và tải dự kiến; threshold và bằng chứng được lưu, không dùng một TPS tùy ý.
- Production readiness gate trong `operations/production-readiness.md` đạt đầy đủ.

## 16. Phase 12 - Production cutover

### Runbook cấp cao

1. Chọn ngày cutover sau rehearsal và thông báo maintenance trong khung 00:00-02:00 Asia/Ho_Chi_Minh.
2. Xác minh PostgreSQL backup/PITR/restore readiness và tạo pre-cutover backups.
3. Bật global maintenance/write freeze, dừng toàn bộ V1 write traffic và jobs có thể ghi; drain in-flight requests/running jobs.
4. Chuẩn bị force-logout/token-version configuration và giữ V2 writes tắt; chưa vô hiệu hóa V1 login trước go/no-go.
5. Tạo MongoDB immutable source manifest/checksum/backup sau freeze.
6. Dựng PostgreSQL cutover sạch từ migrations/seed và chạy full migration.
7. Chạy reconciliation; mọi mismatch balance/history phải đã được remediation hoặc có approved migration anchor, `0 BLOCKING` discrepancy.
8. Dành tối đa 45 phút cuối maintenance cho OpenAPI/critical-flow smoke test và quyết định go/no-go.
9. Nếu đạt, rotate auth/token version để force logout V1, đóng Socket connections, chuyển `ACTIVE_FINANCIAL_WRITE_VERSION` sang V2, mở traffic và bật Agenda handlers trên store đã cô lập.
10. Theo dõi errors, latency, locks, ledger/balances, idempotency, outbox, assets, snapshots và jobs trong 2 giờ đầu.
11. Duy trì hypercare 7 ngày, không triển khai thay đổi lớn không cần thiết.
12. Giữ MongoDB business collections enforced read-only và backup tối thiểu 30 ngày; Agenda database/credential riêng vẫn read-write.

Nếu rehearsal cho thấy hai giờ không đủ, maintenance window phải được mở rộng trước khi công bố; không rút ngắn reconciliation hoặc go/no-go để giữ khung giờ.

Rollback trước khi mở V2 write traffic cho phép bật lại V1 sau khi xác minh MongoDB. Sau khi V2 đã nhận writes, không hỗ trợ rollback về V1 hoặc reverse migration; chỉ forward-fix hoặc restore V2 từ backup/PITR đã diễn tập.

Không xóa MongoDB hoặc tài liệu V1 ngay sau cutover. Việc nâng Agenda và loại MongoDB theo Phase 13-15 trong `docs/v2/operations/agenda-retirement.md`.

Feature flags là kill switch cho endpoint/job V2 lỗi nhưng không chuyển write ngược về V1 sau khi V2 đã mở writes. Read/admin modules có thể rollout riêng; financial write chỉ bật khi toàn bộ dependency đã nằm trên V2.

Chi tiết restore/observability/control-plane tuân theo `docs/v2/operations/production-readiness.md`; final data procedure tuân theo `docs/v2/migration/final-migration-strategy.md`.

## 17. Phase 13-15 - Agenda và MongoDB retirement

- Phase 13: nâng Agenda 5 lên 6 nhưng tiếp tục dùng MongoDB backend.
- Phase 14: sau giai đoạn ổn định, chuyển Agenda 6 sang PostgreSQL backend trong một release độc lập.
- Phase 15: observation/backup/audit xong mới thu hồi MongoDB.

Mỗi phase có rehearsal, exit criteria và rollback riêng; không nâng major version và đổi job backend cùng lúc.

## 18. Definition of Done tổng thể

- Business modules V2 không import `mongodb`, `ObjectId`, `GET_DB` hoặc MongoDB client. Agenda là ngoại lệ cô lập cho đến khi hoàn thành Phase 14; MongoDB chỉ được retire ở Phase 15.
- PostgreSQL có thể dựng từ migrations và seed.
- Không có service ngoài transaction core cập nhật balance.
- Ledger, idempotency, reversal, snapshots, outbox và reconciliation hoạt động.
- Daily balance snapshot chạy idempotent, snapshot chain/checksum hợp lệ và catch up được ngày bị bỏ lỡ.
- Data migration có thể chạy lại, resume và báo cáo lỗi.
- Không có orphan, unbalanced posting hoặc balance mismatch.
- Admin có thể kiểm tra discrepancy, snapshot, outbox và job; không có thao tác sửa trực tiếp ledger/balance.
- API contract được kiểm thử với frontend.
- Routes/controllers/Joi/API mappers nằm trong `src/api/v2`; business/core/infrastructure nằm trong `src/v2` và không phụ thuộc Express.
- V1 tokens bị force logout; V2 HTTP/Socket identity dùng public UUID, refresh rotation/CSRF/CORS/security controls hoạt động.
- Final cutover full reload deterministic, legacy balance mismatch có audited resolution và Agenda store đã tách khỏi business MongoDB.
- Explicit transaction context, full reversal, permanent idempotency tombstone, ordered/leased outbox và temporary asset lifecycle hoạt động.
- PostgreSQL PITR/restore đạt RPO/RTO; observability/alerts/runbooks và feature flag governance sẵn sàng.
- Differential replay/shadow validation đạt yêu cầu mà không dùng live production dual-write.
- Feature flag registry và scheduler abstraction hoạt động; chỉ có một financial write authority.
- Cutover và rollback runbooks đã được diễn tập.
- Tài liệu V1 hiện có được giữ nguyên; tài liệu V2 nằm dưới `docs/v2/`.

## 19. Mẫu task triển khai có kiểm soát

```text
Task: <một module hoặc 1-3 endpoint liên quan>

Đầu vào:
- Đọc docs/v2/README.md và các tài liệu liên quan.

Scope:
- Liệt kê file/thư mục được phép sửa.

Requirements:
- Giữ contract V1 nếu chưa có quyết định thay đổi.
- Không sửa V1 ngoài scope.
- Financial write phải đi qua transaction core.
- Kiểm tra ownership, idempotency và rollback.

Verification:
- Lint.
- Unit/integration/contract tests tương ứng.
- Review diff về financial integrity và security.

Output:
- File thay đổi.
- Test đã chạy.
- Rủi ro/dependency còn lại.
- Cập nhật docs/v2/migration/progress.md.
```
