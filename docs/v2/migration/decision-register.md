# Decision Register V2

Tệp này ghi lại các quyết định đã thống nhất. Thay đổi quyết định phải bổ sung lý do và ảnh hưởng, không sửa lịch sử một cách im lặng.

| ID | Quyết định | Trạng thái |
|---|---|---|
| DEC-001 | V1 tiếp tục chạy production bằng MongoDB trong thời gian phát triển V2. | Accepted |
| DEC-002 | V2 dùng PostgreSQL và chỉ chạy staging cho đến khi hoàn thiện. | Accepted |
| DEC-003 | Không dual-write MongoDB/PostgreSQL; cutover trong maintenance window. | Accepted |
| DEC-004 | Routes V1 và V2 tương ứng về endpoint; controller/service/repository triển khai riêng. | Accepted |
| DEC-005 | V2 tiếp tục dùng tên `service`, không thêm tầng tên `use-case`. | Accepted |
| DEC-006 | V2 dùng Prisma ORM, Prisma Migrate, Joi và Redis. | Accepted |
| DEC-007 | Transaction core là nơi duy nhất cập nhật số dư. | Accepted |
| DEC-008 | Ledger là nguồn sự thật; current balance là cached projection. | Accepted |
| DEC-009 | V2 dùng double-entry/signed postings, idempotency, reversal và reconciliation. | Accepted |
| DEC-010 | Snapshot gồm business JSONB có version và balance before/after. | Accepted |
| DEC-011 | Giữ ObjectId dưới dạng `CHAR(24)` trong lần migration đầu. | Superseded by DEC-022 |
| DEC-012 | Tiền dùng `BIGINT`, tỷ lệ dùng `DECIMAL`, thời gian thống nhất UTC. | Accepted |
| DEC-013 | Tất cả tài liệu mới của V2 nằm dưới `docs/v2/`; không xóa hoặc thay thế docs hiện có. | Accepted |
| DEC-014 | V1 feature freeze; chỉ sửa lỗi cần thiết trong thời gian xây V2. | Accepted |
| DEC-015 | Scheduled jobs tác động tiền phải gọi transaction core. | Accepted |
| DEC-016 | Giữ Agenda 5 và MongoDB job storage trong quá trình phát triển/cutover V2; sau cutover nâng Agenda 5 lên 6 với MongoDB backend trước, rồi mới chuyển Agenda 6 sang PostgreSQL backend ở một bước độc lập. | Accepted |
| DEC-017 | Dùng Supabase PostgreSQL cho môi trường staging trước mắt; hosting PostgreSQL production sẽ được đánh giá riêng trước cutover. | Accepted |
| DEC-018 | Periodic balance snapshot được hoãn thành feature hậu V2; V2 bắt buộc vẫn có business snapshot, balance before/after và reconciliation. | Superseded by DEC-020 |
| DEC-019 | Cutover mặc định trong khung 00:00-02:00 Asia/Ho_Chi_Minh; dành 45 phút go/no-go, 2 giờ early monitoring, 7 ngày hypercare và giữ MongoDB read-only/backup tối thiểu 30 ngày. Ngày cutover cụ thể được chọn sau rehearsal. | Accepted |
| DEC-020 | Periodic balance snapshot là feature bắt buộc của V2, triển khai dưới dạng daily ledger checkpoint theo `posted_at`; Phase 4 xây core/schema và Phase 9 nối lịch chạy Agenda. | Accepted |
| DEC-021 | Lãi suất phần trăm dùng `DECIMAL(7,4)` và decimal arithmetic; saving dùng annual percent, ACTUAL/365 và HALF_UP về BIGINT. Loan/borrowing V2 bắt buộc chọn rate basis; dữ liệu legacy chưa rõ dùng `UNSPECIFIED`. | Accepted |
| DEC-022 | PostgreSQL dùng `BIGINT IDENTITY` làm khóa nội bộ, UUID do database tạo làm public ID, và `legacy_mongo_id CHAR(24)` nullable/unique để mapping dữ liệu V1. API không lộ internal ID. | Accepted |
| DEC-023 | Sau cutover, MongoDB business collections ở read-only; Agenda 5 dùng database/collection MongoDB riêng vẫn read-write cho đến khi hoàn thành các phase loại MongoDB. | Accepted |
| DEC-024 | Ledger chỉ được chuyển `DRAFT -> POSTED` khi database boundary xác nhận tổng postings bằng 0; repository không cung cấp API post từng entry độc lập. | Accepted |
| DEC-025 | Snapshot cutoff dùng account lock, account sequence high-watermark và `clock_timestamp()` tại thời điểm posting; snapshot có version/history và checksum chuỗi entries. | Accepted |
| DEC-026 | Sai lệch migration/reconciliation/snapshot/outbox/jobs được lưu thành discrepancy case và vận hành qua Admin Operations; admin không sửa balance/ledger trực tiếp. | Accepted |
| DEC-027 | Chỉ hỗ trợ rollback về V1 trước khi mở V2 writes. Sau khi V2 nhận writes, chiến lược là forward-fix hoặc restore V2, không reverse-migrate về MongoDB. | Accepted |
| DEC-028 | Sau cutover bổ sung Phase 13 nâng Agenda 5 -> 6 với MongoDB, Phase 14 chuyển Agenda 6 sang PostgreSQL, Phase 15 retire MongoDB. | Accepted |
| DEC-029 | V2 dùng Node.js 20+, Vitest, Supertest, V8 coverage và disposable PostgreSQL/MongoDB/Redis test infrastructure; automated tests không dùng Supabase staging. | Accepted |
| DEC-030 | V2 ban đầu chỉ hỗ trợ VND; tiền lưu `BIGINT` theo đơn vị 1 VND và API serialize amount/balance thành decimal string. | Accepted |
| DEC-031 | Balance policy kế thừa V1: normal account có thể có opening balance âm nhưng outgoing operation không được làm giảm dưới 0; saving/accumulation không âm; system/loan ledger accounts theo normal-side policy riêng. | Accepted |
| DEC-032 | Toàn bộ persisted timestamps và day calculations dùng UTC; lãi không kỳ hạn tương thích V1 theo ngày bắt đầu/kết thúc inclusive, còn kỳ hạn tháng dùng công thức tháng hiện tại. | Accepted |
| DEC-033 | V2 dùng module layout hybrid: giữ tên service; module nhỏ có thể phẳng, module phức tạp tách services/repositories/validators/mappers/policies theo hành động. | Accepted |
| DEC-034 | Financial transaction dùng deterministic row locks, transaction timeout và retry hữu hạn cho serialization/deadlock; idempotency có request fingerprint; outbox delivery at-least-once với consumer idempotency. | Accepted |
| DEC-035 | Mỗi phase có acceptance metrics đo được; performance threshold lấy từ baseline V1 và tải dự kiến thay vì đặt TPS tùy ý. | Accepted |
| DEC-036 | Financial invariant matrix và posting template matrix là deliverable bắt buộc của Phase 3 và là gate trước khi bắt đầu Phase 4. | Accepted |
| DEC-037 | Thêm Phase 10B differential replay/shadow validation trên môi trường cô lập; cấm live shadow-write production và luôn chỉ có một write authority. | Accepted |
| DEC-038 | Tạo job scheduler abstraction từ Phase 2; Agenda 5/MongoDB là adapter ban đầu, business service và transaction core không phụ thuộc Agenda. | Accepted |
| DEC-039 | Feature flag theo module dùng cho staging, read rollout và kill switch; không được chia financial write authority giữa V1/MongoDB và V2/PostgreSQL. | Accepted |
| DEC-040 | Mở rộng `docker-compose.dev.yml` hiện có cho local PostgreSQL và các dependency cần thiết; Testcontainers vẫn dùng riêng cho automated tests. | Accepted |
| DEC-041 | Financial write dùng explicit `TransactionContext` chứa Prisma transaction client; repositories/raw SQL bắt buộc dùng context này, không dùng global Prisma client. | Accepted |
| DEC-042 | Cutover force logout toàn bộ; V2 JWT dùng `sub` là public UUID và token version 2, refresh token V1 không được đổi sang token V2. | Accepted |
| DEC-043 | Final cutover mặc định full reload sau khi freeze/drain toàn bộ V1 writes/jobs; chỉ dùng incremental strategy nếu rehearsal chứng minh full reload vượt maintenance budget. | Accepted |
| DEC-044 | V1 stored account balance tại freeze là operational cutover balance; mọi chênh lệch với reconstructed history là blocking và chỉ xử lý bằng remediation hoặc audited migration anchor đối ứng `MIGRATION_EQUITY`. | Accepted |
| DEC-045 | Agenda MongoDB store/credential được tách khỏi business MongoDB trước cutover; jobs được drain và reschedule bằng stable key, không copy mù internal lock state. | Accepted |
| DEC-046 | PostgreSQL production hosting chốt trước Phase 10B; mục tiêu ban đầu RPO tối đa 5 phút, RTO tối đa 2 giờ, PITR và restore drill bắt buộc. | Accepted |
| DEC-047 | V2 có refresh-token rotation/revocation, CSRF protection khi dùng cross-site cookie, exact CORS allowlist, rate limit, admin step-up auth và database least-privilege roles. | Accepted |
| DEC-048 | `src/api/v2` chứa HTTP routes/controllers/Joi/API mappers; `src/v2` chỉ chứa business modules/core/infrastructure và không phụ thuộc Express HTTP objects. | Accepted |
| DEC-049 | Financial time/business date dùng UTC; user IANA timezone chỉ phục vụ local reminder/notification scheduling và Agenda vẫn nhận UTC `runAt`. | Accepted |
| DEC-050 | V2 ban đầu chỉ hỗ trợ full reversal: transaction mới đảo postings, entries gốc bất biến và original không thể full-reverse lần hai. | Accepted |
| DEC-051 | Financial idempotency key/hash/resource tombstone giữ lâu dài; outbox có aggregate ordering, lease/claim, schema version và unknown-delivery chuyển review thay vì retry mù. | Accepted |
| DEC-052 | Discrepancy/audit schema thuộc Phase 3, internal writer Phase 4, admin API/UI Phase 5. | Accepted |
| DEC-053 | File upload dùng temporary asset lifecycle và cleanup/outbox; không gọi Cloudinary trong PostgreSQL transaction. | Accepted |
| DEC-054 | Production readiness bắt buộc có financial/DB/outbox/job/snapshot observability, alert owner và runbook. | Accepted |
| DEC-055 | Write authority là deployment-level control; runtime module flags fail-closed, có dependency/audit và không được chuyển writes từ V2 về V1. | Accepted |
| DEC-056 | V1 baseline/V2 OpenAPI và approved-difference registry là contract deliverables bắt buộc trước cutover. | Accepted |
| DEC-057 | Master phases được triển khai theo execution waves; mỗi thời điểm chỉ một wave chính active, business phases chia thành vertical slices có staging/sign-off và không chạy toàn plan trong một đợt. | Accepted |
| DEC-058 | Yarn 1.22.22 là package manager canonical; `yarn.lock` là lockfile duy nhất. `package-lock.json` không được tạo/commit và install bằng npm bị chặn tại `preinstall`. | Accepted by project owner 2026-08-01 |
| DEC-059 | Wave 1 dùng Prisma 7.9.1 ngay từ foundation, generator `prisma-client` dạng CommonJS và PostgreSQL driver adapter; generated TypeScript được Babel biên dịch, không chuyển V1 sang ESM. Node tối thiểu là 20.19.0. | Accepted by project owner 2026-08-01 |
| DEC-060 | Dependency audit được project owner hoãn ra ngoài Wave 1; giữ evidence lịch sử nhưng không auto-fix, không tiếp tục xử lý và không dùng làm gate của Wave 1. | Accepted by project owner 2026-08-01 |
| DEC-061 | Agenda staging có thể dùng cùng MongoDB cluster/server hiện có, nhưng bắt buộc dùng database, collection, worker identity và credential read/write riêng; credential đó phải bị từ chối ghi business database. Không dùng chung V1 business credential/store. | Accepted clarification of DEC-045, 2026-08-01 |
| DEC-062 | Biến kết nối PostgreSQL dùng tên tường minh `POSTGRESQL_DATABASE_URL` cho pooled runtime và `POSTGRESQL_DIRECT_URL` cho direct migration; giá trị thật chỉ được nạp từ ignored `.env`/secret manager. Không giữ alias tên cũ để tránh cấu hình nhầm. | Accepted by project owner 2026-08-01 |
| DEC-063 | Agenda V2 chỉ yêu cầu hai biến cấu hình `AGENDA_MONGODB_URI` và `AGENDA_DATABASE_NAME`. Collection là hằng nội bộ `v2_jobs`; worker identity tự sinh từ hostname/process. Quy tắc database/credential tách khỏi V1 của DEC-045/061 vẫn giữ nguyên. | Accepted by project owner 2026-08-01 |
| DEC-064 | `DEPLOYMENT_ENV=production` là ranh giới duy nhất cấm mount API V2. Khi `ENABLE_API_V2=true`, mọi giá trị `DEPLOYMENT_ENV` khác `production` được xem là non-production và có thể bật V2; local/dev và staging không khác nhau về semantics feature gate. Staging vẫn là shared deployment target duy nhất trước cutover, còn V2 write flags tiếp tục mặc định tắt. | Accepted by project owner 2026-08-01 |
| DEC-065 | `transfers.fee` được giữ làm metadata và không tạo balance/ledger effect trong cutover scope, đúng hành vi V1. Muốn thu phí sau này phải có approved API difference, system-account/posting template và migration riêng. | Accepted by project owner 2026-08-02; resolves OPEN-006 |
| DEC-066 | V2 ban đầu chỉ hỗ trợ collection/repayment tất toán toàn phần phần principal còn lại. Không tự tính/post interest; legacy debt rate `UNSPECIFIED` chỉ là metadata. Partial settlement hoặc interest accrual cần decision/template/migration mới. | Accepted by project owner 2026-08-02; resolves OPEN-007 |
| DEC-067 | Financial command tạo money movement phải có amount lớn hơn 0. Account opening vẫn có thể bằng 0 hoặc âm theo DEC-031; accumulation opening bằng 0 không tạo posting. Legacy zero-amount history nếu có được archive/discrepancy, không tạo zero ledger entry. | Accepted by project owner 2026-08-02; resolves OPEN-008 |
| DEC-068 | Giữ family endpoints trong cutover scope vì project owner xác nhận frontend sử dụng toàn bộ V1 endpoints; V2 triển khai semantics đúng và không sao chép lỗi subtype argument dispatcher của V1. Khác biệt sửa lỗi phải nằm trong approved-difference/contract tests. | Accepted by project owner 2026-08-02; resolves OPEN-009 |
| DEC-069 | Không suy luận legacy saving interest được cộng trực tiếp nếu thiếu evidence xác định period, principal, rate và amount. Record không chứng minh được là `BLOCKING`; snapshot Wave 0 hiện có 0 saving record. Không tạo synthetic interest/adjustment. | Accepted by project owner 2026-08-02; resolves OPEN-010 |
| DEC-070 | Transfer thông thường chỉ được phép trong cùng financial space. Contribution personal-to-family được phép khi actor sở hữu nguồn và có membership active ở family; hạch toán nguyên tử bằng hai transaction liên kết, mỗi space cân bằng qua `INTERSPACE_CLEARING`. Reversal phải đảo cả nhóm nguyên tử. | Accepted by project owner 2026-08-02; resolves OPEN-011 |

## Quyết định đang mở

| ID | Nội dung | Thời điểm chốt |
|---|---|---|
| OPEN-005 | Chọn PostgreSQL hosting và cấu hình production sau giai đoạn Supabase staging. | Trước Phase 10B |

## Quyết định mở đã đóng

| ID | Kết quả | Evidence |
|---|---|---|
| OPEN-012 | Resolved by DEC-058: Yarn 1.22.22 và `yarn.lock` là canonical. | `packageManager`, install guard, single-lock verification và frozen install PASS. |
| OPEN-013 | Resolved by DEC-059: nâng lên Prisma 7.9.1 ngay trong Wave 1. | validate/generate/migrate/seed/health, full build, V1 startup regression và 29/29 tests PASS. |
| OPEN-006 | Resolved by DEC-065: fee metadata-only trong cutover scope. | V1 `transferService` mutates source/target by amount only; owner accepted recommendation 2026-08-02. |
| OPEN-007 | Resolved by DEC-066: full principal settlement only, no automatic interest. | V1 permits arbitrary single settlement but has no evidenced interest allocation; owner accepted safe initial scope. |
| OPEN-008 | Resolved by DEC-067: money-moving commands require amount >0; opening exceptions explicit. | V1 Joi permits zero but zero posting has no financial meaning; owner accepted recommendation. |
| OPEN-009 | Resolved by DEC-068: retain/fix family V2 endpoints. | Owner states all V1 endpoints are frontend-used; V1 dispatcher defect remains evidence for corrected V2 semantics. |
| OPEN-010 | Resolved by DEC-069: no unsupported legacy saving-interest inference. | Wave 0 has 0 saving rows; evidence-deficient future row is blocking. |
| OPEN-011 | Resolved by DEC-070: same-space transfer; controlled personal-to-family contribution via linked clearing transactions. | Owner accepted recommendation; physical schema/posting matrix updated before W2-04 approval. |
