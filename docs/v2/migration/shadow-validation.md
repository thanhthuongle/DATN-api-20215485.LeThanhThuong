# Differential Replay and Shadow Validation

## 1. Nguyên tắc

Phase 10B so sánh V1/V2 trên cùng input và dữ liệu nguồn trước cutover. Không live shadow-write vào PostgreSQL từ request production và không cho hai database đồng thời là write authority.

## 2. Ba chế độ an toàn

### Offline differential replay

- Dùng MongoDB snapshot đã kiểm soát và fixture có thể lặp lại.
- Replay command/read vào V1 test environment và V2 staging cô lập.
- Tắt email, socket, notification và external side effects.
- Canonicalize public ID, timestamp động và thứ tự không có ý nghĩa trước khi diff.
- Môi trường V2 dùng UUID identity/token contract; replay không tái sử dụng V1 refresh/access token.

### Shadow read

- Chỉ chạy query/read model V2 không side effect trên dữ liệu staging gần production.
- Kết quả V2 không trả cho người dùng; mismatch được lưu thành discrepancy case.
- Không chạy endpoint có khả năng ghi, cache mutation hoặc enqueue job.

### Captured-command replay

- Capture command/input theo allowlist, loại secret/PII không cần thiết.
- Replay bất đồng bộ vào database PostgreSQL staging resettable.
- Dùng namespace/idempotency riêng và tuyệt đối không dispatch production side effects.
- File/Cloudinary operations dùng fake/temporary staging namespace và được cleanup sau replay.

## 3. Canonical comparison

So sánh HTTP contract, authorization outcome, normalized errors, entity state, financial postings, cached balance, interest, reports và job intent. Khác biệt đã được thiết kế chủ ý phải nằm trong approved-difference registry; phần còn lại tạo discrepancy.

## 4. KPI/exit criteria Phase 10B

- 100% critical financial flows trong posting matrix được replay cả success và failure paths.
- 100% endpoint trong cutover scope có contract/differential result hoặc approved exception.
- 0 mismatch ledger/balance/authorization chưa phân loại.
- 0 discrepancy `BLOCKING`; `REQUIRES_REVIEW` có owner và quyết định.
- Replay cùng dataset/version cho kết quả lặp lại; không phát sinh side effect ngoài staging.
- Báo cáo latency/throughput V1 baseline và V2 được lưu để đặt go/no-go performance threshold.
