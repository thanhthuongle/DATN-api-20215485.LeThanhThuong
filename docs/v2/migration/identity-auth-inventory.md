# V1 Identity, JWT, Refresh, Socket and ObjectId Compatibility Inventory

Ngày inventory: 2026-08-01. Target decisions: DEC-022, DEC-042, DEC-047.

## 1. Identity surface

| Surface | V1 contract/evidence | V2 compatibility impact | Owner/status |
|---|---|---|---|
| User persistence ID | MongoDB `_id: ObjectId`; serialized publicly as 24-hex string | map to internal BIGINT + public UUID + `legacy_mongo_id` | identity/migration / INVENTORIED |
| API resource IDs | raw `_id` and relation ObjectIds are returned by most controllers/services; `pickUser` explicitly returns `_id` | V2 may retain field name `_id` for contract but value becomes UUID; approved difference/tests required | API platform |
| URL/body/query IDs | Joi ObjectId regex on create payloads; many path/update/bulk bodies lack validation | UUID validation and mapper boundary required; errors will differ unless approved | API platform |
| JWT actor | `_id` + email claims, plus library `iat/exp` | cutover token cannot be translated; V2 uses `sub=public UUID`, `ver=2`, `jti` | identity |
| Socket identity | accessToken cookie -> decoded `_id` -> in-memory `Map<userId, Set<socketId>>` | disconnect all at cutover; reconnect with V2 UUID subject | realtime |
| Agenda payload identity | many payloads persist user/resource ObjectIds | jobs must resolve through legacy mapping/stable business keys; do not copy raw locks | jobs/migration |
| Redis key identity | category/bank cache keys include V1 ObjectId strings; no version namespace | purge/separate namespaces; never reinterpret cached V1 key as UUID | cache/platform |
| Frontend/local storage | no frontend source/access logs in repo; project owner confirms all 55 operations remain in scope | exact cache-location telemetry unavailable; conservatively invalidate all V1 client identity/resource-ID state | frontend/product / RESOLVED_FOR_SCOPE |

Static dependency size: 43 source files import/use MongoDB module patterns; 221 `new ObjectId(...)` calls; only 3 `ObjectId.isValid(...)` calls; 13 controller/middleware files consume `req.jwtDecoded._id`.

## 2. Access and refresh token behavior

`JwtProvider` signs/verifies HS256 tokens directly through `jsonwebtoken`.

| Concern | V1 behavior | Finding |
|---|---|---|
| Claims | login signs `{ _id: existUser._id, email }`; JWT adds `iat`,`exp` | no `sub`, `ver`, `jti`, issuer or audience |
| Secrets/lifetime | distinct access/refresh env secret and lifetime | exact values intentionally not inventoried/logged |
| Access transport | cookie `accessToken` only; auth middleware ignores Authorization header | contract baseline |
| Refresh transport | GET `/users/refresh_token`, refresh cookie | state-changing GET sets access cookie; no CSRF/Origin check beyond CORS |
| Refresh verification | verifies signature/expiry then copies `_id,email` into new access token | no user lookup, active/password/token-version check |
| Rotation/revocation | none; refresh token is not persisted or hashed | stolen token reusable until expiry; no family/reuse detection |
| Logout | clears browser cookies only | token remains cryptographically valid; no server revocation |
| Password change/block | does not revoke existing tokens | existing access/refresh remain valid |
| Expired access behavior | HTTP 410 `Need to refresh token.` | V2 likely normalizes to 401; approved-difference registry needed |
| Cookie attributes | login: HttpOnly, Secure, SameSite=None, maxAge 14d; refresh access same; logout clear has no matching options | cross-site cookie requires CSRF controls; cookie maxAge may differ from configured JWT life |

## 3. HTTP authorization flow

1. `authMiddleware.isAuthorized` reads the access cookie.
2. JWT signature/expiry is verified with access secret.
3. Entire decoded object is assigned to `req.jwtDecoded`.
4. Controllers use `req.jwtDecoded._id`; family middleware compares it to `managerIds/memberIds`.
5. Some services check owner ObjectId, but financial source/target ownership is inconsistent as recorded in `financial-flows.md`.

There is no role/permission claim enforcement, rate limit, session lookup, token version or centralized financial-space authorization context in source.

## 4. Socket compatibility

| Item | V1 evidence | Risk/rule |
|---|---|---|
| Authentication | parses raw `Cookie` header by splitting `; `, finds `accessToken=`, verifies access secret | no cookie parser/URL decode, no session/revocation check |
| Identity key | `socket.userId = jwtDecoded._id` | V1 ObjectId-shaped subject; V2 must use UUID `sub` |
| Connection registry | process-local Map of userId to socket IDs | multi-instance delivery not shared; restart loses registry |
| Emission | notification service looks up Map by userId and emits `notification` | call-site userId string representation must exactly match map key |
| Cutover | no disconnect-all/token-version hook | runbook must stop/restart/close V1 connections after force logout |

Force-logout acceptance: rotate signing secret or global token version, reject/clear all V1 cookies, revoke V2 session families as applicable, close existing sockets, purge V1 identity caches and require fresh UUID login. Refresh V1 must never mint V2 access token.

## 5. ObjectId compatibility register

| Location class | Examples | Migration rule |
|---|---|---|
| Primary IDs | all 26 collections `_id` | retain as nullable unique `legacy_mongo_id`; create DB UUID public ID; do not expose BIGINT. |
| Polymorphic owner | ownerType + ownerId on money/accounts/categories/transactions/etc. | resolve correct user/family target by type; orphan/type mismatch -> discrepancy. |
| Polymorphic money source | type + from/target ID across eight detail collections | resolve to typed source/ledger account; type/collection conflict -> blocking. |
| Embedded/ref arrays | family roles, money-source child IDs, transactionIds, category graph, budget refs | normalize join/child rows; deduplicate and count orphan/conflicts. |
| JWT/Socket | token `_id`; socket Map keys | force logout; no translation. |
| Agenda | payload ObjectIds and cancel queries | manifest/reschedule using UUID/stable key after entity mapping; no internal lock copy. |
| Redis | keys containing V1 IDs | version namespace/purge; no in-place key conversion. |
| API response | `_id` and nested ObjectIds | mapper emits UUID string; contract tests/approved difference. |

Most source functions call `new ObjectId(value)` directly. Only family middleware and two transaction-detail methods visibly call `ObjectId.isValid`; invalid IDs elsewhere may surface driver exceptions/500 rather than consistent 400/422. V2 contract must normalize this intentionally.

## 6. Cached/frontend ID transition inventory

Confirmed server-side cached identity locations:

- Redis keys: `banks:id:<id>`, `categories:individual:<userId>`, `categories:family:<familyId>`, category type keys and future account keys.
- process memory: Socket `userSockets` Map keyed by V1 token `_id`.
- Agenda Mongo payloads/cancel selectors: userId, savingId, accumulationId, loanTransactionId, borrowingTransactionId.
- database denormalizations: all ObjectId arrays in `mongodb-inventory.md`.

Potential client locations remain localStorage/sessionStorage, Redux/query caches, persisted URLs, offline queue, idempotency keys, selected account/family IDs and socket auth assumptions. Because no frontend source is present, Wave 0 adopts the conservative owner-approved rule: treat **all** persisted V1 client IDs/tokens/caches as incompatible, force logout, clear client persistence and require fresh UUID-backed reads. No cached ObjectId is translated in place.

## 7. Security and compatibility findings

| ID | Finding | Severity | Owner/action |
|---|---|---|---|
| AUTH-001 | Refresh token has no rotation, storage, revoke or reuse detection. | CRITICAL | Identity schema/session family per DEC-047. |
| AUTH-002 | Refresh does not re-check user active/password/security version. | CRITICAL | Identity policy + integration tests. |
| AUTH-003 | SameSite=None cookie flow has no explicit CSRF token/origin middleware. | CRITICAL | API security owner; decide same-site topology or CSRF. |
| AUTH-004 | Logout is client-cookie only. | MAJOR | V2 server-side session revoke; cutover global invalidation. |
| AUTH-005 | JWT exposes legacy `_id` and email, lacks UUID subject/version/jti. | BLOCKING cutover compatibility | Force logout; never refresh-convert V1 token. |
| AUTH-006 | Socket accepts same legacy token and has no cutover disconnect control. | BLOCKING runbook | Realtime owner. |
| AUTH-007 | ObjectId validation/error behavior is inconsistent. | MAJOR contract | UUID boundary validation and approved error differences. |
| AUTH-008 | Exact frontend cached ObjectId locations cannot be inventoried from this repo. | RESOLVED_FOR_SCOPE | Project-owner scope attestation + conservative force-clear rule; frontend implementation must prove the cleanup in its later integration/cutover checklist. |

## 8. Review record

- Read: JWT provider, user auth service/controller/validation, auth/family middleware, Socket server, CORS config, formatter, ObjectId call sites, Agenda/cache identity locations.
- Coverage: access, refresh, cookie, logout, HTTP actor, Socket actor, server caches, Agenda payload IDs and database ObjectIds classified.
- No secrets/token values were read into documentation.
- Diff review: documentation only; no auth secret, cookie, token, Socket or V1 behavior changed.
- Frontend limitation is closed for Wave 0 by treating every V1 client token/cache/ID as incompatible; no claim of observed storage telemetry is made.
