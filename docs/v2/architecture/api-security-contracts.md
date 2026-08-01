# API Layer, Identity, Security and Contracts V2

## 1. Boundary source code

```text
src/api/v2/
├── routes/
├── controllers/
├── validations/
├── mappers/
└── index.js

src/v2/
├── modules/
├── core/
└── infrastructure/
```

- `src/api/v2` là HTTP layer: Express routes, authentication middleware, Joi request validation, chuyển `params/query/body/file` thành input, gọi V2 service và định dạng HTTP response.
- `src/api/v2/index.js` chỉ compose/mount routers.
- Controller không gọi Prisma/Redis/Agenda, không tạo postings và không chứa business rule.
- `src/v2` không biết `req/res/next` hoặc HTTP status code. Module service xử lý nghiệp vụ/policy; core xử lý quy tắc tài chính; infrastructure cung cấp PostgreSQL, cache, jobs và messaging.
- API response mapper ở `src/api/v2/mappers`; mapper domain/persistence nếu cần nằm trong module V2.

Luồng chuẩn:

```text
route -> auth -> Joi -> controller -> V2 service
-> policy/repository/transaction core -> controller mapper -> response
```

Actor lấy từ authentication context, không lấy `userId/ownerId` trong request body.

## 2. Identity và force logout khi cutover

- V2 token dùng `sub = user.public_id` UUID, `ver = 2`, `jti` và expiry; không nhúng internal BIGINT hoặc legacy ObjectId.
- Cutover rotate signing secret hoặc tăng global auth token version để toàn bộ access/refresh token V1 bị từ chối.
- Request mang token cũ nhận `401` và server clear cookies; người dùng bắt buộc đăng nhập lại.
- Refresh token V1 không được đổi thành access token V2.
- Socket.IO đóng/restart connections trong cutover và chỉ reconnect bằng token V2.
- Frontend phải xóa assumptions ObjectId/local cached IDs và hiển thị thông báo yêu cầu đăng nhập lại.

## 3. Session và cookie security

- Access token ngắn hạn, mục tiêu 15 phút.
- Refresh token rotation; chỉ lưu hash trong PostgreSQL session table, gồm session family, expiry, revoked/replaced metadata.
- Refresh-token reuse revoke toàn session family. Đổi mật khẩu, khóa user và security action revoke sessions liên quan.
- Cookie luôn `HttpOnly` và `Secure`. Ưu tiên `SameSite=Lax` nếu triển khai cùng site.
- Nếu bắt buộc `SameSite=None`, state-changing request phải có CSRF token, kiểm tra `Origin/Referer` và CORS exact allowlist.
- Login, refresh, verification và financial commands có Redis-backed rate limit theo IP/actor/scope phù hợp.

## 4. Authorization và admin security

- Authentication chỉ xác định actor; service/policy tiếp tục kiểm tra financial-space membership, role, resource ownership và trạng thái resource.
- Admin API deny-by-default và dùng permission riêng.
- Reversal/adjustment nhạy cảm bắt buộc step-up authentication: nhập lại mật khẩu, TOTP/MFA, reason và evidence. Maker-checker được thêm khi có từ hai admin phù hợp.
- Database roles tách `migration_role`, `application_role`, `job_role`, `readonly_role`; frontend không dùng service credential kết nối database trực tiếp.
- Secrets rotate trước cutover; logs không chứa JWT, cookie, password, secret hoặc snapshot/PII không cần thiết.

## 5. API contract

Deliverables:

```text
docs/v2/api/openapi-v1-baseline.yaml
docs/v2/api/openapi-v2.yaml
docs/v2/api/approved-differences.md
```

V2 OpenAPI phải mô tả `_id/public ID` UUID string, money decimal string, UTC ISO-8601 timestamp, error envelope/code, pagination/sorting/filtering, nullable fields, idempotency header và deprecation policy. Contract tests validate implementation với specification và approved-difference registry.

## 6. Definition of Done

- Không controller V2 chứa business logic hoặc gọi database/infrastructure trực tiếp.
- Token V1 không thể dùng sau cutover; HTTP và Socket đều dùng UUID subject.
- Refresh rotation/revocation, CSRF mode, CORS và rate limits có integration/security tests.
- IDOR tests bao phủ mọi resource có financial-space ownership.
- Frontend/UAT xác nhận UUID, money string, force logout và error contracts.
