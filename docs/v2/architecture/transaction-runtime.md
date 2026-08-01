# Transaction Runtime, Idempotency, Outbox and Assets V2

## 1. Explicit transaction context

Transaction core là nơi duy nhất mở `prisma.$transaction()`. Financial repositories bắt buộc nhận explicit context:

```text
TransactionContext
- db: Prisma TransactionClient
- transactionPublicId
- actor
- financialSpaceId
- correlationId
- idempotencyKey
```

```js
await transactionManager.execute(async (txContext) => {
  await ledgerRepository.createEntries(txContext, entries)
  await accountRepository.updateBalances(txContext, balances)
  await outboxRepository.create(txContext, event)
})
```

- Cấm global Prisma client trong financial write path.
- Raw/TypedSQL financial write phải chạy bằng `txContext.db`.
- Repository read-only ngoài transaction có thể dùng application client.
- Không gọi provider, Redis, Socket hoặc Agenda trong database transaction.
- Phase đầu dùng explicit context, không dùng implicit `AsyncLocalStorage` làm nguồn transaction authority.

## 2. Financial transaction state và reversal

V2 ban đầu chỉ hỗ trợ full reversal:

```text
DRAFT (chỉ bên trong DB transaction) -> POSTED -> REVERSED
```

- `DRAFT` phải chuyển `POSTED` trước commit; database boundary xác nhận postings cân bằng.
- Failure rollback không để lại financial transaction `FAILED`; attempt/error nằm trong idempotency/operation log.
- Reversal tạo transaction `POSTED` mới với `reverses_transaction_id`, postings ngược và business snapshot riêng.
- Reversal khóa transaction gốc, không sửa/xóa entries gốc, và unique rule ngăn full reversal lần hai.
- Partial reversal chưa thuộc V2 ban đầu. Nếu cần sau này, phải có thiết kế giới hạn tổng reversal và state `PARTIALLY_REVERSED` riêng.

## 3. Idempotency protocol

Unique identity:

```text
financial_space_id, actor_type, actor_id, operation, idempotency_key
```

- `request_hash` dùng canonical semantic input, bỏ correlation/request timestamps không ảnh hưởng nghiệp vụ.
- Cùng key/hash trả kết quả trước; cùng key khác hash trả `409`.
- State tối thiểu: `IN_PROGRESS`, `COMPLETED`, `FAILED_FINAL`.
- Claim, business write, resource reference và completion phải có recovery protocol rõ ràng để crash-after-commit trả lại kết quả cũ.
- Financial key/hash/resource tombstone giữ lâu dài; response body có thể purge sau 90 ngày. Scheduled financial key giữ suốt vòng đời nghiệp vụ.

## 4. Outbox protocol

Ngoài fields đã định nghĩa, outbox có:

```text
aggregate_id, aggregate_sequence, event_schema_version
lease_owner, lease_expires_at, next_attempt_at
```

- Worker claim bằng `FOR UPDATE SKIP LOCKED`, lease có timeout và retry/backoff hữu hạn.
- Ordering bảo đảm theo aggregate sequence; event contract versioned.
- Provider nhận `event_id` làm idempotency key khi hỗ trợ.
- Nếu side effect có thể đã thành công nhưng ack thất bại và provider không cho tra cứu/dedup, event chuyển `REQUIRES_REVIEW`, không retry mù.
- Consumer/inbox dedup record sống ít nhất bằng event replay horizon; dead-letter tạo discrepancy case.

## 5. Temporary asset lifecycle

Cloudinary/file upload không chạy trong PostgreSQL transaction:

```text
upload temporary asset -> nhận asset ID
-> financial request dùng asset ID
-> DB transaction tạo attachment PENDING
-> commit/outbox -> attachment ACTIVE
```

- Temporary asset có owner/upload session, checksum, content type, size và expiry.
- File type/size được validate; asset không được reference chéo actor/financial space.
- DB rollback để asset ở trạng thái temporary; cleanup job xóa asset không được reference sau thời gian an toàn, mặc định 24 giờ.
- Retry cùng idempotency key tái sử dụng attachment đã link, không upload/finalize trùng.
- Delete/replacement dùng outbox/compensating cleanup và giữ evidence cần thiết cho transaction audit.

## 6. Required tests

- Fail injection ở từng repository chứng minh ledger, balance, business snapshot, idempotency completion và outbox rollback cùng nhau.
- Test phát hiện repository dùng global client trong financial write.
- Concurrent idempotency claims, deadlock retry, crash-after-commit và outbox lease recovery.
- Provider success-before-ack, aggregate ordering và poison event.
- Upload success/DB failure, cleanup race và request retry không tạo asset trùng.
