# Data Migration Strategy V2

## 1. Mục tiêu

Biến inventory MongoDB thành các quy tắc chuyển đổi có thể chạy lại, kiểm thử và đối soát. Không field hoặc record nào bị bỏ qua im lặng.

## 2. Rule catalog bắt buộc

Mỗi collection/field có một dòng gồm source path/type/cardinality, target table/column, transform, default/null policy, validation, dependency/load order, reject code và reconciliation query.

Quy tắc theo loại dữ liệu:

- Embedded document: giữ JSONB có lý do hoặc tách thành bảng con với ownership/order rõ ràng.
- Array reference: chuyển thành join/child rows, deduplicate theo business key; giữ thứ tự nếu nghiệp vụ phụ thuộc.
- ObjectId: resolve sang internal FK qua `legacy_mongo_id`; orphan không được tự nối hoặc bỏ qua.
- Duplicate: phân loại exact duplicate, duplicate business key và conflicting duplicate; chỉ auto-merge khi rule được duyệt.
- Missing/null/invalid legacy: transform có chứng cứ, archive hoặc reject thành discrepancy case.
- Financial history: tái dựng ledger theo posting template đã duyệt; không tạo adjustment im lặng để ép cached balance khớp.
- Legacy current balance được so với reconstructed history với tolerance `0 VND`; mismatch là blocking và xử lý theo `final-migration-strategy.md`.

## 3. Pipeline và khả năng chạy lại

```text
extract manifest -> stage raw immutable copy -> validate/transform
-> load theo dependency graph -> reconcile -> discrepancy report
```

- Batch có checkpoint theo collection và stable source key.
- Upsert/deduplicate dựa trên `legacy_mongo_id` hoặc migration key đã chốt.
- Mỗi run lưu source snapshot ID/checksum, code/schema version, counts, totals, rejects và thời gian.
- Resume không được tạo duplicate; chạy lại cùng input/version phải cho cùng kết quả.

## 4. Reconciliation

Tối thiểu so sánh:

- count nguồn/đích theo entity và trạng thái;
- foreign key/orphan và unique business key;
- tổng amount, balance, debt principal, saving principal/interest;
- ledger balanced, cached balance và periodic/bootstrap snapshot;
- sampled record-level canonical hash và toàn bộ record tài chính trọng yếu.

Mỗi sai lệch tạo discrepancy case có source record, expected/actual, rule version và remediation. Cutover bị chặn khi còn `BLOCKING`.

Final cutover mặc định full reload sau global write/job freeze. Incremental migration không được dựa riêng vào ObjectId/`updatedAt`; chỉ được thêm bằng decision riêng nếu full reload rehearsal vượt maintenance budget.

## 5. Deliverables

```text
mongodb-postgresql-mapping.md
migration-rule-catalog.md
load-dependency-graph.md
legacy-financial-posting-rules.md
reconciliation-specification.md
data-quality-report.md
```

Tên file chi tiết có thể điều chỉnh sau inventory, nhưng nội dung và khả năng truy vết không được bỏ.

## 6. Wave 0 rule-catalog result

Wave 0 đã tạo `migration-rule-catalog.md` với **26/26 collection rules** và các rule chung cho ID/type, money, UTC time, soft delete, duplicate và file provenance. Đây là baseline `DRAFT`, không phải target schema hay migration implementation.

Wave 0 profiling evidence:

- production: 15 live/26 source-declared collections, 11 absent/empty, 16 indexes và 0 non-`_id` unique indexes;
- required/null, monetary, enum, timestamp, array, duplicate và relation classes đã có actual counts/examples;
- 6/6 balance records khớp reconstructed balance tại tolerance `0 VND`;
- 4 provider-orphan assets và 4 unversioned Agenda payloads có owner/rule, không bị tự động xóa/copy.

Các điều kiện chưa đạt để chuyển catalog từ `DRAFT` thành approved Phase 3 design:

- OPEN-006..OPEN-011 chưa chốt;
- target PostgreSQL schema thuộc Phase 3, nằm ngoài phạm vi Wave 0.
