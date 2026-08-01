# V1/V2 Approved API Differences

Ngày khởi tạo: 2026-08-01. Owner: API platform owner; security-sensitive differences require security owner review, business-contract differences require module/product owner review.

## Registry policy

- Chỉ dòng có status `APPROVED` và đủ approver/evidence mới là khác biệt được phép trong contract/differential tests.
- `PROPOSED` không phải chấp thuận triển khai. Không được dùng finding V1 hoặc thiết kế V2 làm approved difference ngầm.
- Mỗi record phải ghi V1 contract, V2 contract, lý do, endpoint/operation, compatibility impact, rollout/consumer plan và decision/evidence.
- ID ổn định theo dạng `API-DIFF-NNN`; không tái sử dụng ID đã reject/supersede.
- Contract test mặc định fail với mọi khác biệt không có record `APPROVED`.

## Approved registry

Hiện có **0 approved differences**.

| ID | Operation(s) | V1 contract | V2 contract | Status | Owner/approver | Evidence/decision |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — |

## Candidate findings — not approved

| Candidate | Scope | Why it needs a decision | Current status |
|---|---|---|---|
| API-001 | `POST /transactions/` actor handling | V1 accepts owner identity through body/service path; V2 must derive actor from auth context. | PROPOSED; linked to OPEN-009, not approved |
| API-002 | Bulk transaction detail endpoints | V1 body IDs lack route validation/complete actor evidence; V2 requires ownership/IDOR enforcement. | PROPOSED; security review required |
| API-003 | Unvalidated update/close endpoints | Adding strict V2 validation can change accepted payload/error behavior. | PROPOSED; per-module contract decision required |
| API-004 | Family recent transactions | V1 controller calls an individual-named service method with family ID. | INVESTIGATE; no behavior change approved |
| API-005 | `GET /notifications/test` | V1 GET schedules an Agenda side effect; V2 staging/production exposure is unsafe without an explicit decision. | PROPOSED; linked to OPEN-009 |
| API-006 | Error envelope and stack | V2 security/error standard may intentionally differ from the V1 development envelope. | PROPOSED; security/API owner approval required |

Source evidence for every candidate is in `docs/v2/migration/endpoint-inventory.md`. All 55 operations remain in migration scope by project-owner attestation; this file does not deprecate or omit any operation.
