# Financial Invariant and Posting Template Matrix

## 1. Trạng thái và gate

Đây là khung deliverable, chưa phải mô tả nghiệp vụ cuối cùng. Phase 0 điền hành vi V1; Phase 3 chốt thiết kế V2. Phase 4 không được bắt đầu cho đến khi mọi financial flow trong inventory có dòng tương ứng được review.

## 2. Financial invariant matrix

Mỗi entity/flow phải ghi tối thiểu:

| Flow/entity | Invariant trước | Invariant sau | Balance policy | Ownership/authorization | Concurrency risk | Evidence V1 | Status |
|---|---|---|---|---|---|---|---|
| `<inventory item>` | TBD | TBD | TBD | TBD | TBD | file/test/fixture | DRAFT |

Invariant dùng ngôn ngữ kiểm chứng được, ví dụ tổng postings bằng 0, entry bất biến, cached balance bằng ledger tại sequence hiện tại. Không dùng mô tả mơ hồ như “balance hợp lệ”.

## 3. Posting template matrix

Mỗi command làm thay đổi tiền phải có một template:

| Transaction type | Trigger/API/job | Debit/credit hoặc signed postings | Account roles/system accounts | Preconditions | Lock order | Balance rule | Business snapshot | Reversal/adjustment | Idempotency scope | Migration rule | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `INCOME` | TBD | TBD | TBD | TBD | internal ID tăng dần | TBD | TBD | TBD | TBD | TBD | TBD | DRAFT |
| `EXPENSE` | TBD | TBD | TBD | TBD | internal ID tăng dần | TBD | TBD | TBD | TBD | TBD | TBD | DRAFT |
| `TRANSFER` | TBD | TBD | TBD | TBD | internal ID tăng dần | TBD | TBD | TBD | TBD | TBD | TBD | DRAFT |
| `CONTRIBUTION` | TBD | TBD | TBD | TBD | internal ID tăng dần | TBD | TBD | TBD | TBD | TBD | TBD | DRAFT |
| `LOAN_DISBURSEMENT` | TBD | TBD | TBD | TBD | internal ID tăng dần | TBD | TBD | TBD | TBD | TBD | TBD | DRAFT |
| `BORROWING` | TBD | TBD | TBD | TBD | internal ID tăng dần | TBD | TBD | TBD | TBD | TBD | TBD | DRAFT |
| `REPAYMENT` | TBD | TBD | TBD | TBD | internal ID tăng dần | TBD | TBD | TBD | TBD | TBD | TBD | DRAFT |
| `COLLECTION` | TBD | TBD | TBD | TBD | internal ID tăng dần | TBD | TBD | TBD | TBD | TBD | TBD | DRAFT |
| `SAVING_DEPOSIT` | TBD | TBD | TBD | TBD | internal ID tăng dần | TBD | TBD | TBD | TBD | TBD | TBD | DRAFT |
| `SAVING_INTEREST` | TBD | TBD | TBD | TBD | internal ID tăng dần | TBD | TBD | TBD | TBD | TBD | TBD | DRAFT |
| `SAVING_MATURITY/CLOSE` | TBD | TBD | TBD | TBD | internal ID tăng dần | TBD | TBD | TBD | TBD | TBD | TBD | DRAFT |
| `OPENING_BALANCE` | TBD | TBD | TBD | TBD | internal ID tăng dần | TBD | TBD | TBD | TBD | TBD | TBD | DRAFT |

Inventory có flow khác phải thêm dòng; không ép flow V1 vào một template gần giống nhưng sai nghĩa.

## 4. Tiêu chí duyệt trước Phase 4

- 100% vị trí mutation tiền và financial jobs đã map vào template hoặc được ghi rõ là deprecated/archive-only.
- Mỗi template có postings cân bằng, account roles/system accounts và normal-side rõ ràng.
- Preconditions, authorization, balance policy, lock order và idempotency scope có thể chuyển thành test.
- Reversal không update/delete ledger gốc.
- Business snapshot fields đủ tái dựng quyết định tại thời điểm post.
- Legacy transaction có migration rule; trường hợp không thể ánh xạ tạo discrepancy, không tự adjustment.
- Transaction-core API chỉ nhận template đã duyệt, không cho service tự tạo postings tùy ý.
