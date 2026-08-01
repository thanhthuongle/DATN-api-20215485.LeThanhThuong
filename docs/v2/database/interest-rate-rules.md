# Quy tắc lãi suất V2

Mọi mốc thời gian và phép đếm ngày trong V2 dùng UTC. Lãi không kỳ hạn giữ tương thích V1 bằng cách tính inclusive cả ngày bắt đầu và ngày kết thúc; các test phải bao phủ ranh giới tháng/năm và leap day. Kỳ hạn theo tháng giữ công thức tháng của V1 cho đến khi có quyết định nghiệp vụ thay thế.

Khi tính nhiều kỳ liên tiếp, boundary day không được đếm hai lần: kỳ đầu có thể bao gồm ngày bắt đầu theo V1, kỳ sau bắt đầu sau `previous_period_end` hoặc dùng interval tương đương đã ghi trong posting template. User timezone không tham gia phép tính lãi.

## 1. Kiểu dữ liệu

Lãi suất phần trăm dùng:

```text
DECIMAL(7,4)
```

Phạm vi biểu diễn cần dùng:

```text
0.0000-100.0000
```

Không dùng PostgreSQL `FLOAT/DOUBLE` hoặc JavaScript `Number` cho phép tính tiền lãi. Service sử dụng Prisma Decimal hoặc decimal library tương đương.

## 2. Saving

Các cột dự kiến:

```text
annual_rate           DECIMAL(7,4)
non_term_annual_rate  DECIMAL(7,4)
day_count_convention  ACTUAL_365
rounding_mode         HALF_UP
```

`annual_rate` và `non_term_annual_rate` đều là phần trăm năm.

### Công thức theo ngày

```text
interest = principal * annualRatePercent * actualDays / 36500
```

### Công thức kỳ hạn theo tháng đang tương thích V1

```text
interest = principal * annualRatePercent * termMonths / 1200
```

Chỉ làm tròn một lần ở kết quả cuối.

## 3. Loan và borrowing

V2 dùng rate basis rõ ràng:

```text
ANNUAL_PERCENT
MONTHLY_PERCENT
FIXED_AMOUNT
UNSPECIFIED
```

Thiết kế field dự kiến:

```text
rate_basis             enum
rate_value             DECIMAL(7,4), nullable
fixed_interest_amount  BIGINT, nullable
```

Constraint nghiệp vụ:

- `ANNUAL_PERCENT` hoặc `MONTHLY_PERCENT`: bắt buộc `rate_value`, không có `fixed_interest_amount`.
- `FIXED_AMOUNT`: bắt buộc `fixed_interest_amount`, không có `rate_value`.
- `UNSPECIFIED`: chỉ dành cho dữ liệu legacy chưa xác định đơn vị; V2 không tự động tính lãi.
- Request tạo loan/borrowing mới không được chọn `UNSPECIFIED`.

Nếu frontend/nghiệp vụ sau này xác nhận toàn bộ legacy loan rate là phần trăm năm, cần một migration có kiểm chứng để đổi `UNSPECIFIED` thành `ANNUAL_PERCENT`; không cập nhật hàng loạt theo giả định.

## 4. Làm tròn tiền

Đối với VND:

```text
storage type: BIGINT
rounding mode: HALF_UP
rounding time: kết quả cuối cùng
```

Không làm tròn rate, intermediate daily rate hoặc từng thừa số giữa công thức.

Ví dụ:

```text
1234.49 -> 1234
1234.50 -> 1235
```

## 5. Validation

- Saving rate: `0.0000-100.0000`, tối đa bốn chữ số thập phân.
- Loan/borrowing percentage rate: giới hạn domain có thể hẹp hơn, nhưng database type vẫn là `DECIMAL(7,4)`.
- Fixed interest amount không âm và phải nằm trong giới hạn `BIGINT`/business policy.
- API input được parse thành decimal string/Decimal trước khi tính toán.
- Không tin rate basis hoặc principal thuộc resource mà actor không có quyền truy cập.

## 6. Migration V1

- Saving `rate` -> `annual_rate`.
- Saving `nonTermRate` -> `non_term_annual_rate`.
- Loan/borrowing `rate` -> `rate_value` và `rate_basis = UNSPECIFIED` nếu chưa có bằng chứng về đơn vị.
- Giữ nguyên giá trị decimal; không tự scale `6.5` thành `0.065`.
- Record không phải number, ngoài range hoặc có precision bất thường phải vào data-quality report.

## 7. Test bắt buộc

- Rate có 0, 2 và 4 chữ số thập phân.
- Lãi theo ngày và theo tháng.
- Boundary 0% và 100%.
- HALF_UP tại đúng nửa đơn vị.
- Không làm tròn intermediate values.
- Legacy `UNSPECIFIED` không được tự tính lãi.
- Validation từng rate basis.
- Kết quả V2 tương thích công thức V1 trên fixture hiện có.
- Nhiều kỳ liên tiếp không đếm trùng boundary day.
