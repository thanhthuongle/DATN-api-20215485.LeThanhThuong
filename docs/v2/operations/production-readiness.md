# Production Readiness, Recovery and Control Plane

## 1. Production hosting gate

PostgreSQL production hosting/configuration phải chốt trước Phase 10B để differential performance, backup và restore rehearsal chạy trên kiến trúc gần production. Hosting phải có TLS, connection pooling phù hợp Prisma transactions/raw SQL, automated backup và point-in-time recovery.

Mục tiêu ban đầu:

```text
RPO <= 5 phút
RTO <= 2 giờ
backup retention >= 30 ngày
```

- Daily automated backup, pre-cutover/pre-major-deploy backup và monthly restore drill sang database khác.
- Không đánh dấu backup hợp lệ chỉ vì job báo thành công; phải kiểm tra restore và reconciliation.
- Redis là cache, không là nguồn sự thật; sau restore xóa/rebuild cache.

## 2. Restore V2 sau khi đã mở writes

```text
đóng V2 writes -> dừng outbox/scheduler
-> chọn restore point/PITR -> restore database mới
-> migrate/verify schema -> ledger/balance/idempotency/outbox reconciliation
-> clear Redis -> reconcile/reschedule jobs -> smoke test -> mở V2
```

- Event/job có trạng thái không rõ sau restore không retry mù; dùng provider lookup/idempotency hoặc discrepancy review.
- Restore report ghi restore point, estimated/actual data loss, reconciliation results và người phê duyệt.
- MongoDB không nhận reverse-migrated V2 writes.

## 3. Observability và SLO

Theo dõi transaction success/failure/duration, lock wait/deadlock/retry, idempotency conflict/stuck record, outbox lag/dead-letter, job lateness, reconciliation age/discrepancy, snapshot backlog/checksum, PostgreSQL pool saturation và API error/P95 latency.

- Mỗi request/job có correlation ID; financial operation có public transaction ID.
- Alert có severity, owner và runbook; balance/ledger mismatch là critical.
- Performance threshold lấy từ V1 baseline và hot-account contention workload, không chỉ aggregate TPS.
- Logs redacted, structured và không chứa secrets/PII/full financial snapshots không cần thiết.

## 4. Feature flag governance

Deployment-level authority:

```text
ACTIVE_FINANCIAL_WRITE_VERSION=V1|V2
```

Flag này chỉ đổi trong cutover deployment; sau khi V2 nhận writes không đổi về V1.

Runtime module flags có namespace như `v2.accounts.read`, `v2.transactions.write`, `v2.admin.enabled`, `v2.jobs.snapshot.enabled`:

- source of truth có version/audit, Redis chỉ cache;
- default fail-closed và có dependency graph;
- actor, reason, before/after, timestamp được audit;
- snapshot flag một lần ở đầu request/job, không đọc lại giữa transaction;
- kill switch đóng endpoint/job V2 nhưng không chuyển write sang MongoDB.

## 5. Operational security

- Roles: migration/application/job/readonly; audit/ledger roles không có update/delete ngoài sanctioned function.
- Secret rotation, CORS/CSRF, admin step-up auth và session revocation phải được rehearsal.
- Business snapshot/raw migration staging được phân loại PII, mã hóa theo hosting và purge theo retention.
- Ledger-history entities dùng `RESTRICT` hoặc soft-delete; không hard-delete làm mất audit chain.

## 6. Production readiness gate

- Hosting/connection mode, RPO/RTO và backup retention được ghi nhận.
- Restore drill đạt RTO và reconciliation không phát hiện sai lệch.
- Dashboard/alerts/runbooks và on-call owner sẵn sàng.
- Feature flags/write-authority controls được audit và rehearsal.
- Security review, OpenAPI contract, hot-account/load test và cutover rehearsal đạt yêu cầu.
