# V1 Endpoint, Middleware and API Contract Inventory

Ngày inventory: 2026-08-01. Phạm vi: V1 source hiện tại; không suy diễn contract từ thiết kế V2.

## 1. Baseline và phương pháp

- Mount thực tế: `app.use('/', APIs)` trong `src/server.js`; chưa có `/api/v1` hoặc `/api/v2`.
- Đã đọc toàn bộ `src/routes/*`, `src/controllers/*`, `src/validations/*`, `src/middlewares/*`, `src/server.js`; đối chiếu service/model được gọi bằng import và return path.
- Tổng cộng **55 HTTP operations**: 27 GET, 19 POST, 5 PUT, 3 PATCH, 1 DELETE.
- Owner của mỗi operation là module route/controller/service tương ứng. Status `ACTIVE_V1` nghĩa là được mount trong `src/routes/index.js`; chưa chứng minh có frontend gọi.
- Không có file test/spec/fixture trong repo và không có frontend source. Vì vậy cột usage là `UNKNOWN_NO_FRONTEND_EVIDENCE`; không endpoint nào được tự đánh dấu unused/deprecated.

## 2. Global HTTP contract

Thứ tự middleware toàn ứng dụng (`src/server.js:20-43`): `Cache-Control: no-store` -> `cookieParser` -> CORS -> JSON -> URL-encoded -> cache statistics logger -> routes -> centralized error handler.

| Contract | Hành vi V1 có bằng chứng |
|---|---|
| Success body | Controller trả trực tiếp object/array/result của service; không có response envelope chung. |
| Create | HTTP 201 cho register và các create account/accumulation/budget/contact/family/saving/transaction. |
| Read/update | HTTP 200. `/` trả HTML; `/status` trả `{ message }`; logout trả `{ loggedOut: true }`. |
| Error body | `{ statusCode, message, stack? }`; `stack` bị bỏ khi `BUILD_MODE !== 'dev'` (`errorHandlingMiddleware.js:5-15`). |
| Validation error | HTTP 422, Joi message được bọc trong `ApiError`; validators dùng `abortEarly: false`. |
| Access token | Cookie `accessToken`; thiếu token -> 401, token expired -> 410, token invalid -> 401 (`authMiddleware.js:7-32`). |
| Family authorization | `familyId` phải là ObjectId; missing family -> 404; non-member -> 403; non-manager -> 403 (`familyMiddleware.js:6-64`). |
| Upload | Memory upload qua Multer; MIME chỉ jpg/jpeg/png theo allowlist, size theo `LIMIT_COMMON_FILE_SIZE`; invalid -> 422. |
| Query parsing | `qs.parse`; các controller đọc `req.query.q`, trong đó `budget` kỳ vọng `q.isFinish`. |
| Cookies | Login set access/refresh cookie `HttpOnly`, `Secure`, `SameSite=None`, maxAge 14 ngày; refresh chỉ set lại access cookie; logout clear cookie không lặp options. |

Ký hiệu middleware trong bảng: `A` auth; `FM` family member; `FG` family manager; `J:<name>` Joi; `U1/U5` upload single/array tối đa 5. Mọi row bên dưới có status `ACTIVE_V1` và usage `UNKNOWN_NO_FRONTEND_EVIDENCE`.

## 3. Endpoint inventory

### System và users — owner `system` / `users`

| Method/path | Middleware | Input contract | Response/status | Dependency/evidence |
|---|---|---|---|---|
| GET `/` | global | none | 200 HTML `Hello World` | inline, `routes/index.js:19` |
| GET `/status` | global | none | 200 `{message}` | inline, `routes/index.js:23` |
| POST `/users/register` | `J:user.createNew` | body `email,password` | 201 sanitized user | `userController.createNew` -> `userService.createNew` -> user/category models; `userRoutes.js:9` |
| PUT `/users/verify` | `J:user.verifyAccount` | body `email,token` | 200 sanitized user | `userController.verifyAccount`; `userRoutes.js:12` |
| POST `/users/login` | `J:user.login` | body `email,password` | 200 `{accessToken,refreshToken,...user}` plus cookies | `userController.login`; `userRoutes.js:15` |
| DELETE `/users/logout` | none | none | 200 `{loggedOut:true}`; clears cookies | controller-only; `userRoutes.js:18` |
| GET `/users/refresh_token` | none | refresh cookie | 200 `{accessToken}` plus cookie; any service error normalized to 401 | `userController.refreshToken`; `userRoutes.js:21` |
| PUT `/users/update` | `A,U1(avatar),J:user.update` | multipart; display/password/language/currency/reminder settings; validator permits unknown fields | 200 sanitized user | `userController.update` -> user service/Cloudinary/Agenda; `userRoutes.js:24` |

### Accounts, accumulations, savings and money sources

| Method/path | Owner | Middleware | Input contract | Response/status | Dependency/evidence |
|---|---|---|---|---|---|
| GET `/accounts/individual` | accounts | `A` | optional query `q` | 200 service result | account controller/service/model; `accountRoute.js:9` |
| POST `/accounts/individual` | accounts | `A,J:account.createNew` | `type,accountName,initBalance`; optional `bankId,description,icon` | 201 account | account service/model, bank; `accountRoute.js:9` |
| PATCH `/accounts/individual/:accountId/block` | accounts | `A` | path ObjectId; no route validator | 200 account/update result | account ownership checked in service; `accountRoute.js:13` |
| PATCH `/accounts/individual/:accountId/unblock` | accounts | `A` | path ObjectId; no route validator | 200 account/update result | account ownership checked in service; `accountRoute.js:16` |
| GET `/accounts/family/:familyId` | accounts | `A,FM` | path ObjectId | 200 service result | account/family models; `accountRoute.js:19` |
| POST `/accounts/family/:familyId` | accounts | `A,FG,J:account.createNew` | same create body | 201 account | manager gate; account/bank/family; `accountRoute.js:19` |
| GET `/accumulations/individual` | accumulations | `A` | none | 200 service result | accumulation service/model; `accumulationRoute.js:9` |
| POST `/accumulations/individual` | accumulations | `A,J:accumulation.createNew` | `accumulationName,targetBalance,startDate,endDate`; optional description | 201 accumulation | accumulation/account models; `accumulationRoute.js:9` |
| PATCH `/accumulations/individual/:accumulationId` | accumulations | `A` | unvalidated body may supply `moneyTargetId,moneyTargetType` | 200 finish result | ownership/finish checks in service; `accumulationRoute.js:13` |
| POST `/accumulations/family/:familyId` | accumulations | `A,FG,J:accumulation.createNew` | create body | 201 accumulation | manager gate; `accumulationRoute.js:16` |
| GET `/savings/individual` | savings | `A` | none | 200 service result | saving service/model; `savingRoute.js:9` |
| POST `/savings/individual` | savings | `A,J:saving.createNew` | saving terms/rates/source/targets defined in validator | 201 saving | saving/account/bank/Agenda; `savingRoute.js:9` |
| POST `/savings/individual/:savingId/close` | savings | `A` | unvalidated `moneyTargetId,moneyTargetType` | 200 closed saving | saving service/models; `savingRoute.js:13` |
| POST `/savings/family/:familyId` | savings | `A,FG,J:saving.createNew` | saving create body | 201 saving | manager gate; `savingRoute.js:16` |
| GET `/moneySources/individual` | money-sources | `A` | none | 200 combined money sources | moneySource service -> account/saving/accumulation; `moneySourceRoute.js:8` |
| GET `/moneySources/family/:familyId` | money-sources | `A,FM` | family ObjectId | 200 combined money sources | member gate; `moneySourceRoute.js:11` |

### Transactions — owner `transactions`

`J:transaction.createNew` accepts common `type,categoryId,name,amount,transactionTime,detailInfo`, optional `responsiblePersonId,proposalId,description`; `detailInfo` depends on eight types: expense, income, loan, collect, borrowing, repayment, transfer, contribution. Amount is integer `>= 0`; ObjectIds are 24-hex strings.

| Method/path | Middleware | Input contract | Response/status | Dependency/evidence |
|---|---|---|---|---|
| POST `/transactions/` | `A,J:transaction.createNew` | transaction body; actor is **not passed** to service | 201 transaction | generic legacy `transactionService.createNew`; `transactionRoutes.js:10`, controller line 4 |
| GET `/transactions/individual` | `A` | optional query `q` | 200 transaction list/aggregation | `getIndividualTransactions`; `transactionRoutes.js:13` |
| POST `/transactions/individual` | `A,U5(images),J:transaction.createNew` | multipart transaction body | 201 transaction | dispatches to type service; `transactionRoutes.js:13` |
| GET `/transactions/individual/fullInfo` | `A` | optional query `q` | 200 full transaction aggregation | `getFullInfoIndividualTransactions`; `transactionRoutes.js:17` |
| GET `/transactions/individual/recentTransactions` | `A` | none | 200 recent list | transaction service/model; `transactionRoutes.js:20` |
| POST `/transactions/individual/detailTransactions` | `A` | unvalidated body, IDs consumed by service | 200 many detail records | no ownership middleware at route; `transactionRoutes.js:23` |
| GET `/transactions/individual/:transactionId` | `A` | path ObjectId | 200 type-specific detail | actor passed to service; `transactionRoutes.js:26` |
| GET `/transactions/family/:familyId` | `A,FM` | path ObjectId, optional `q` | 200 list | family gate; `transactionRoutes.js:30` |
| POST `/transactions/family/:familyId` | `A,FG,J:transaction.createNew` | transaction body | 201 transaction | manager-only; `transactionRoutes.js:30` |
| GET `/transactions/family/:familyId/recentTransactions` | `A,FM` | path ObjectId | 200 recent list | controller calls method named `getIndividualRecentTransactions(familyId)`; `transactionRoutes.js:34` |
| POST `/transactions/family/:familyId/detailTransactions` | `A,FM` | unvalidated body | 200 many detail records | family membership checked, body IDs not route-validated; `transactionRoutes.js:37` |
| GET `/transactions/family/:familyId/:transactionId` | `A,FM` | path ObjectIds | 200 type-specific detail | family gate; `transactionRoutes.js:40` |

### Budgets, categories, contacts and families

| Method/path | Owner | Middleware | Input contract | Response/status | Dependency/evidence |
|---|---|---|---|---|---|
| GET `/budgets/individual` | budgets | `A` | `q.isFinish` string converted to boolean | 200 budgets | budget/category/transaction models; `budgetRoute.js:9` |
| POST `/budgets/individual` | budgets | `A,J:budget.createNew` | `categoryId,amount,startTime,endTime,repeat` | 201 budget | budget/category/Agenda; `budgetRoute.js:9` |
| GET `/budgets/family/:familyId` | budgets | `A,FM` | `q.isFinish` | 200 budgets | member gate; `budgetRoute.js:13` |
| POST `/budgets/family/:familyId` | budgets | `A,FG,J:budget.createNew` | budget body | 201 budget | manager gate; `budgetRoute.js:13` |
| GET `/categories/individual` | categories | `A` | optional `q` | 200 categories | category service/model/cache; `categoryRoute.js:8` |
| GET `/categories/family/:familyId` | categories | `A,FM` | optional `q` | 200 categories | member gate; `categoryRoute.js:11` |
| GET `/contacts/individual` | contacts | `A` | none | 200 contacts | contact model; `contactRoute.js:9` |
| POST `/contacts/individual` | contacts | `A,J:contact.createNew` | body `name` | 201 contact | contact model; `contactRoute.js:9` |
| PUT `/contacts/individual/update` | contacts | `A` | unvalidated body, expected contact identifier/trust data | 200 update result | ownership checked in service; `contactRoute.js:13` |
| GET `/contacts/family/:familyId` | contacts | `A,FM` | family ObjectId | 200 contacts | member gate; `contactRoute.js:16` |
| POST `/contacts/family/:familyId` | contacts | `A,FM,J:contact.createNew` | body `name` | 201 contact | any member allowed; `contactRoute.js:16` |
| GET `/families/` | families | `A` | none | 200 families | family model/aggregation; `familyRoute.js:9` |
| POST `/families/` | families | `A,U1(backgroundImage),J:family.createNew` | multipart `familyName`, optional `inviteeIds[]` | 201 family | family/user/category/Cloudinary; `familyRoute.js:9` |

### Banks, loans and notifications

| Method/path | Owner | Middleware | Input contract | Response/status | Dependency/evidence |
|---|---|---|---|---|---|
| GET `/banks/` | banks | `A` | none | 200 banks | bank model/cache; `bankRoute.js:7` |
| GET `/banks/:bankId` | banks | `A` | unvalidated path ID | 200 bank/null per service | bank model/cache; `bankRoute.js:10` |
| PUT `/loans/individual/update` | loans | `A` | unvalidated body | 200 update result | loan ownership checked in service; `loanRoute.js:7` |
| GET `/notifications/test` | notifications | `A` | none | 200 raw Agenda `now()` result | controller imports Agenda/ObjectId directly; external job side effect; `notificationRoute.js:7` |
| GET `/notifications/` | notifications | `A` | none | 200 notifications | notification models; `notificationRoute.js:10` |
| PUT `/notifications/:userNotificationId` | notifications | `A` | path ID + unvalidated body | 200 update result | ownership/read-state checks in service; `notificationRoute.js:13` |

## 4. Request schema summary

| Validator | Applied operations | Notable contract/risk |
|---|---:|---|
| user | 4 | update permits unknown fields; reminder time is ISO date, no IANA timezone field. |
| account | 2 | `initBalance` may be any integer, including negative; bankId optional ObjectId. |
| accumulation | 2 | target >= 0; ISO start/end and custom ordering check. |
| budget | 2 | amount >= 0; no custom start/end ordering check. |
| contact | 2 | only `name`. |
| family | 1 | optional array of invitee ObjectIds; no duplicate rule. |
| saving | 2 | rates use JS/Joi number precision 2; source fixed to account; no route validation on close. |
| transaction | 3 | eight detail variants; amount permits zero; uses JS Number; no idempotency key. |

18/55 operations have explicit Joi middleware; 3/55 accept uploads; 47/55 require access-token auth; 15/55 use family member/manager middleware.

## 5. Contract and security findings to carry forward

| ID | Evidence-backed finding | Classification/owner | Phase 0 status |
|---|---|---|---|
| API-001 | `POST /transactions/` is mounted and authenticated but controller calls `createNew(req.body)` without JWT actor. Generic service reads owner IDs from body. | Security/transactions | OPEN; preserve as baseline, decide deprecate or contract-test before V2. |
| API-002 | Bulk detail endpoints accept unvalidated body. Individual bulk controller does not pass JWT actor; service method must be reviewed for IDOR. | Security/transactions | OPEN; test requirement. |
| API-003 | Several update/close routes have no Joi middleware: account block/unblock, accumulation finish, saving close, contact/loan trust update, notification mark-read. | Contract owners by module | OPEN; V1 behavior frozen, V2 contract must document/validate. |
| API-004 | Family recent controller calls `getIndividualRecentTransactions(familyId)`. | Transactions | OPEN; possible naming/behavior defect, no test evidence. |
| API-005 | `/notifications/test` is an authenticated GET that schedules a side effect and controller directly imports Agenda. | Notifications/jobs | OPEN; candidate non-production/deprecate decision. |
| API-006 | Error stack is exposed in dev and errors are not described by OpenAPI; service errors include 400/401/403/404/406/409/410/422/500. | API platform | OPEN; V1 OpenAPI baseline required by DEC-056. |
| API-007 | There is no automated test command/dependency or test fixture in `package.json`/repo. | Testing | BLOCKER for behavioral proof; Phase 2 owns test foundation. |
| API-008 | Frontend source/access logs are absent, so observed per-endpoint traffic cannot be independently measured. | Product/frontend | RESOLVED_FOR_SCOPE by project-owner attestation below; telemetry remains unavailable. |
| API-009 | Project owner confirmed on 2026-08-01 that all 55 mounted V1 operations are used by frontend and must remain in migration scope. | Product/API scope | ACCEPTED SCOPE INPUT; no endpoint may be deprecated solely because traffic evidence is absent. |

### Frontend scope attestation

The project owner explicitly confirmed: **55/55 V1 operations are frontend-used and remain in migration scope**. Wave 0 records this as an owner scope decision rather than fabricated access-log telemetry. Route existence/method/contract is independently evidenced by the 55 source rows above. Any later deprecation or contract change requires an approved difference; source defects such as API-001/API-004 are still defects to resolve, not permission to omit the endpoint.

## 6. Review record

- Coverage review: all 13 mounted domain routers plus two inline system routes accounted for; static method total reconciles to 55.
- Dependency review: every row maps route -> controller/inline handler -> owner service/model family; direct Agenda/Cloudinary dependencies called out.
- Diff review: this file and `progress.md` only; no `src/`, runtime config, dependency or V1 behavior change.
- Decision alignment: preserves V1 per DEC-001/014; records baseline needed for route parity/OpenAPI under DEC-004/056; no V2 implementation started.
- Frontend scope review: 55/55 operations are in scope by project-owner attestation; no access-log metric is claimed.
