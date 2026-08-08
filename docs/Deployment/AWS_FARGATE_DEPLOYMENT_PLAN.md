# Kế hoạch triển khai Backend lên AWS ECS Fargate

Tài liệu này là checklist thực thi và nghiệm thu việc triển khai backend lên AWS. Các giai đoạn phải được thực hiện theo thứ tự; chỉ chuyển sang giai đoạn tiếp theo khi tiêu chí hoàn thành của giai đoạn hiện tại đã đạt.

## Cách sử dụng tài liệu

- Cập nhật cột **Trạng thái** trong bảng tổng quan bằng một trong bốn giá trị: `Chưa bắt đầu`, `Đang thực hiện`, `Hoàn thành`, `Bị chặn`.
- Đánh dấu `[x]` chỉ sau khi đầu việc đã được triển khai và kiểm tra.
- Ghi nguyên nhân vào cột **Ghi chú** nếu một giai đoạn bị chặn.
- Không ghi password, token, connection string hoặc secret vào tài liệu này.
- Image triển khai phải được nhận diện bằng Git commit SHA để có thể truy vết và rollback.

## Tổng quan tiến độ

|    # | Giai đoạn                             | Trạng thái       | Ghi chú |
| ---: | ------------------------------------- | ---------------- | ------- |
|    1 | Tinh chỉnh source                     | `Đang thực hiện` |         |
|    2 | Docker build và kiểm thử local        | Chưa bắt đầu     |         |
|    3 | Tạo AWS infrastructure bằng Terraform | Chưa bắt đầu     |         |
|    4 | Deploy thủ công lần đầu               | Chưa bắt đầu     |         |
|    5 | Thiết lập GitHub CI/CD                | Chưa bắt đầu     |         |
|    6 | Domain, HTTPS và smoke test           | Chưa bắt đầu     |         |
|    7 | Monitoring và rollback test           | Chưa bắt đầu     |         |

## Quyết định kiến trúc đã chốt

- [X] Backend chạy bằng Amazon ECS Fargate tại region Singapore (`ap-southeast-1`).
- [X] Database tiếp tục sử dụng MongoDB Atlas; ưu tiên đặt cluster trên AWS Singapore.
- [X] Redis chưa được triển khai trong giai đoạn đầu; `CACHE_ENABLED=false`.
- [X] Hạ tầng được khai báo và quản lý bằng Terraform.
- [X] ECS task chạy trong private subnet và truy cập Internet qua một NAT Gateway có Elastic IP tĩnh.
- [X] Domain và DNS tiếp tục được quản lý tại nhà cung cấp ngoài AWS.
- [X] Backend bắt đầu với một ECS task (`desired_count=1`).
- [X] Agenda tiếp tục chạy chung với API trong giai đoạn đầu.
- [X] Frontend tiếp tục chạy trên Vercel.
- [X] Application Load Balancer xử lý HTTPS, WebSocket và chuyển tiếp request tới ECS; không thêm Nginx vào backend.

## Thông tin triển khai cần ghi nhận

> Chỉ ghi identifier, hostname và ARN không nhạy cảm. Không ghi secret hoặc connection string.

| Thông tin                         | Giá trị             |
| --------------------------------- | ------------------- |
| AWS Account ID                    | `TBD`               |
| AWS Region                        | `ap-southeast-1`    |
| Terraform state bucket            | `TBD`               |
| API domain                        | `api.<your-domain>` |
| MongoDB Atlas region              | `TBD`               |
| ECR repository                    | `TBD`               |
| ECS cluster                       | `TBD`               |
| ECS service                       | `TBD`               |
| ECS task definition family        | `TBD`               |
| ALB DNS name                      | `TBD`               |
| ALB ARN                           | `TBD`               |
| Target group ARN                  | `TBD`               |
| NAT Elastic IP                    | `TBD`               |
| ACM certificate ARN               | `TBD`               |
| CloudWatch log group              | `TBD`               |
| GitHub Actions deploy role ARN    | `TBD`               |
| GitHub Actions Terraform role ARN | `TBD`               |

---

## Giai đoạn 1 — Tinh chỉnh source

### Mục tiêu

Chuẩn bị ứng dụng để chạy ổn định trong container và đáp ứng các yêu cầu về health check, cấu hình, shutdown và bảo mật của ECS.

### Điều kiện bắt đầu

- Repository chạy được ở môi trường local.
- Có quyền đọc cấu hình MongoDB Atlas hiện tại.
- Các thay đổi mã nguồn phải tuân thủ GitNexus: chạy `impact` trước khi sửa symbol và `detect_changes` sau khi hoàn tất.

### Checklist đầu việc

- [X] Chạy GitNexus impact analysis cho từng function/method sẽ chỉnh sửa và ghi nhận blast radius.
- [X] Thêm endpoint `GET /health` trả HTTP `200` khi process đã sẵn sàng nhận request.
- [X] Đảm bảo health endpoint không phụ thuộc Redis và không làm lộ thông tin nhạy cảm.
- [X] Chuẩn hóa ứng dụng lắng nghe trên `PORT`, mặc định local là `8017`. Kỳ vọng ứng dụng khởi tạo ở port 8017 bằng dodockeerr.
- [X] Thay CORS whitelist hard-code bằng biến `CORS_ALLOWED_ORIGINS` dạng danh sách phân tách bằng dấu phẩy.
- [X] Giữ `credentials: true` và chỉ cho phép các origin được khai báo rõ ràng.
- [X] Giữ `CACHE_ENABLED=false` làm mặc định cho deployment đầu tiên.
- [X] Startup thất bại phải kết thúc bằng exit code khác `0`.
- [X] Xử lý `SIGTERM` và `SIGINT` theo thứ tự: ngừng nhận request mới, đóng HTTP/Socket.IO, dừng Agenda, đóng MongoDB rồi kết thúc process.
- [X] Đảm bảo shutdown có timeout để container không treo vô hạn.
- [X] Không log JWT, cookie, MongoDB URI, API key hoặc secret.
- [X] Cập nhật `.env.example` với đầy đủ tên biến nhưng không chứa giá trị thật.
- [X] Cập nhật tài liệu chạy production/local nếu command khởi động thay đổi.
- [X] Chạy lint, build và các test hiện có.
- [X] Chạy GitNexus `detect_changes` để xác nhận chỉ các symbol và flow dự kiến bị ảnh hưởng.

### Biến môi trường liên quan

| Biến                           | Loại           | Yêu cầu                                                         |
| ------------------------------ | -------------- | --------------------------------------------------------------- |
| `BUILD_MODE`                   | Không nhạy cảm | Giá trị production là`production`                               |
| `CORS_ALLOWED_ORIGINS`         | Không nhạy cảm | Chứa Vercel production URL; không dùng wildcard với credentials |
| `MONGODB_URI_PRODUCTION`       | Secret         | Lấy từ Secrets Manager                                          |
| `DATABASE_NAME`                | Không nhạy cảm | Tên database production                                         |
| `CACHE_ENABLED`                | Không nhạy cảm | `false` trong phase đầu                                         |
| JWT/Brevo/Cloudinary variables | Secret         | Lấy từ Secrets Manager                                          |

### Cách kiểm tra

- [X] `GET /health` trả `200` và response tối giản.
- [X] Origin hợp lệ gọi API kèm cookie thành công.
- [X] Origin không nằm trong allowlist bị từ chối.
- [X] Gửi `SIGTERM` và xác nhận process đóng kết nối rồi exit thành công.
- [X] Cố tình cung cấp MongoDB URI sai và xác nhận process exit non-zero.
- [X] Tìm kiếm repository để đảm bảo không phát sinh secret mới trong file tracked.

### Tiêu chí hoàn thành

- [X] Lint, build và test đều thành công.
- [X] Health check, CORS và graceful shutdown đã được kiểm chứng local.
- [X] `.env.example` đầy đủ và không chứa secret.
- [X] GitNexus không báo phạm vi thay đổi ngoài dự kiến.

### Rủi ro và rollback

- Thay đổi startup/shutdown có thể ảnh hưởng Agenda và Socket.IO; giữ commit riêng để rollback dễ dàng.
- CORS sai có thể chặn frontend; giữ lại danh sách origin production hiện tại trong cấu hình môi trường.
- Nếu health check mới gây lỗi startup, rollback revision source trước đó và điều tra độc lập.

---

## Giai đoạn 2 — Docker build và kiểm thử local

### Mục tiêu

Tạo image production nhỏ, tái lập được, không chứa secret và chạy bằng non-root user.

### Điều kiện bắt đầu

- Giai đoạn 1 đã hoàn thành.
- Ứng dụng build và chạy trực tiếp ở local thành công.

### Checklist đầu việc

- [ ] Tạo multi-stage `Dockerfile` sử dụng Node.js LTS với version được pin rõ ràng.
- [ ] Cài dependencies từ lockfile bằng chế độ immutable/frozen.
- [ ] Build Babel ở build stage.
- [ ] Runtime stage chỉ chứa build output và production dependencies.
- [ ] Tạo non-root user và chạy ứng dụng bằng user này.
- [ ] Expose port `3000` và khai báo Docker health check gọi `/health`.
- [ ] Tạo `.dockerignore` loại trừ `.env`, `.git`, `node_modules`, coverage, cache, log và tài liệu không cần thiết.
- [ ] Không bake biến môi trường hoặc secret production vào image.
- [ ] Gắn OCI labels tối thiểu cho source revision và repository.
- [ ] Build image local với tag Git SHA.
- [ ] Chạy container bằng file env local ngoài image.
- [ ] Kiểm tra image history/layers không chứa secret.
- [ ] Ghi lại command build, run và smoke test trong tài liệu dự án.

### Tài nguyên liên quan

- `Dockerfile` production.
- `.dockerignore`.
- Docker Engine/Docker Desktop local.
- MongoDB Atlas development hoặc database test có hỗ trợ replica set.

### Cách kiểm tra

- [ ] Docker build thành công từ clean checkout.
- [ ] Container chạy bằng non-root user.
- [ ] `/health` trả `200` qua mapped port.
- [ ] Login/API cơ bản và Socket.IO hoạt động từ container.
- [ ] Agenda khởi động đúng một lần.
- [ ] Ứng dụng hoạt động khi không có `REDIS_URL` và `CACHE_ENABLED=false`.
- [ ] Dừng container và xác nhận graceful shutdown xuất hiện trong log.

### Tiêu chí hoàn thành

- [ ] Image có thể build và chạy độc lập trên máy khác chỉ với Docker và biến môi trường hợp lệ.
- [ ] Không có secret trong image hoặc build log.
- [ ] Smoke test container thành công.

### Rủi ro và rollback

- Native dependency có thể khác giữa build/runtime image; giữ cùng distribution và architecture cho hai stage.
- Nếu image production không chạy, tạm quay lại image build đơn giản để phân lập lỗi nhưng không deploy image đó lên production.

---

## Giai đoạn 3 — Tạo AWS infrastructure bằng Terraform

### Mục tiêu

Tạo hạ tầng AWS có thể tái lập, bảo mật và đủ nhỏ cho đồ án nhưng giữ cấu trúc production.

### Điều kiện bắt đầu

- Giai đoạn 2 đã hoàn thành.
- AWS account đã bật MFA và có quyền tạo IAM, VPC, ECS, ECR, ALB, ACM, CloudWatch và Secrets Manager.
- AWS Budget đã được xác định trước khi tạo tài nguyên tính phí.

### Checklist đầu việc

- [ ] Bootstrap S3 bucket cho Terraform state với encryption, versioning và block public access.
- [ ] Bật S3 state locking và tách bootstrap state khỏi production state.
- [ ] Pin Terraform và provider versions.
- [ ] Tạo VPC tại `ap-southeast-1`.
- [ ] Tạo hai public subnet và hai private subnet ở hai Availability Zone.
- [ ] Tạo Internet Gateway và route tables phù hợp.
- [ ] Tạo một NAT Gateway cùng Elastic IP và route outbound cho private subnets.
- [ ] Tạo ALB ở public subnets.
- [ ] Tạo ALB security group chỉ nhận HTTP/HTTPS công khai.
- [ ] Tạo ECS security group chỉ nhận port `3000` từ ALB security group.
- [ ] Tạo private ECR repository với image scanning, encryption và lifecycle policy.
- [ ] Tạo ECS cluster, task definition và service sử dụng Fargate.
- [ ] Đặt task ban đầu ở mức `0.25 vCPU/0.5 GB RAM`, `desired_count=1`.
- [ ] Tắt public IP cho ECS task.
- [ ] Tạo target group kiểm tra `GET /health`.
- [ ] Bật ECS deployment circuit breaker và automatic rollback.
- [ ] Tạo CloudWatch log group với retention 14 ngày.
- [ ] Tạo ECS execution role và application task role riêng, áp dụng least privilege.
- [ ] Tạo Secrets Manager entries cho MongoDB, JWT, Brevo và Cloudinary secrets; nhập giá trị bằng kênh bảo mật, không đưa vào Terraform state nếu có thể tránh.
- [ ] Cấu hình task definition lấy secret trực tiếp từ Secrets Manager.
- [ ] Tạo AWS Budget và cảnh báo chi phí thực tế/dự báo.
- [ ] Chạy `terraform fmt -check`, `validate` và review `plan` trước khi apply.
- [ ] Apply hạ tầng và ghi identifier không nhạy cảm vào bảng thông tin triển khai.
- [ ] Whitelist NAT Elastic IP trong MongoDB Atlas Network Access.

### Tài nguyên liên quan

- Terraform state S3 bucket.
- VPC, subnets, route tables, Internet Gateway, NAT Gateway và Elastic IP.
- ECR, ECS cluster/service/task definition.
- ALB, listeners, target group và security groups.
- CloudWatch, IAM, Secrets Manager và AWS Budget.
- MongoDB Atlas Network Access list.

### Cách kiểm tra

- [ ] `terraform plan` sau apply không còn thay đổi ngoài dự kiến.
- [ ] ECS task không có public IP.
- [ ] ECS security group không nhận traffic trực tiếp từ Internet.
- [ ] ECR không public và image scanning được bật.
- [ ] NAT Elastic IP là IP duy nhất được Atlas cho phép từ AWS deployment.
- [ ] IAM role không có wildcard permission không cần thiết.
- [ ] CloudWatch log group và Budget alarm tồn tại.

### Tiêu chí hoàn thành

- [ ] Hạ tầng được tạo hoàn toàn từ Terraform.
- [ ] Network, IAM, logging và secret injection đã sẵn sàng cho deployment.
- [ ] Atlas đã whitelist NAT Elastic IP.
- [ ] Terraform state được lưu an toàn và có versioning.

### Rủi ro và rollback

- NAT Gateway và ALB phát sinh phí liên tục; cấu hình Budget trước khi apply.
- Không chạy `terraform destroy` production nếu chưa review chính xác target.
- Nếu apply lỗi, sửa configuration và apply tiếp; không chỉnh thủ công tài nguyên Terraform quản lý trừ trường hợp khẩn cấp có ghi nhận.

---

## Giai đoạn 4 — Deploy thủ công lần đầu

### Mục tiêu

Chứng minh image, AWS network, secrets, ECS, ALB và Atlas hoạt động trước khi tự động hóa bằng CI/CD.

### Điều kiện bắt đầu

- Giai đoạn 3 đã hoàn thành.
- Có quyền push ECR và cập nhật ECS service.
- Secret production đã được nhập vào Secrets Manager.

### Checklist đầu việc

- [ ] Đăng nhập Docker vào ECR bằng credential ngắn hạn.
- [ ] Build image từ commit đã xác định.
- [ ] Tag image bằng full Git SHA và push lên ECR.
- [ ] Kiểm tra kết quả ECR image scan trước khi deploy.
- [ ] Tạo task definition revision tham chiếu image SHA/digest.
- [ ] Cập nhật ECS service và chờ service stable.
- [ ] Kiểm tra task pull image và inject secret thành công.
- [ ] Kiểm tra target chuyển sang healthy.
- [ ] Kiểm tra CloudWatch nhận startup/runtime log.
- [ ] Xác nhận ECS kết nối Atlas qua NAT EIP.
- [ ] Xác nhận Agenda khởi động một lần và collection job hoạt động.
- [ ] Xác nhận Redis không được khởi tạo.
- [ ] Ghi task definition revision và image SHA đã deploy.

### Tài nguyên liên quan

- Local Docker CLI và AWS CLI.
- ECR repository.
- ECS task definition/service.
- ALB target group.
- CloudWatch Logs và MongoDB Atlas.

### Cách kiểm tra

- [ ] ALB gọi `/health` thành công.
- [ ] API đọc/ghi thử nghiệm vào Atlas thành công.
- [ ] Một luồng transaction MongoDB quan trọng chạy thành công.
- [ ] Agenda tạo/lock/run job thành công.
- [ ] Socket.IO handshake và WebSocket upgrade thành công qua ALB.
- [ ] Không có secret trong ECS event hoặc CloudWatch log.

### Tiêu chí hoàn thành

- [ ] ECS service stable với một healthy task.
- [ ] API, Atlas, Agenda, Socket.IO và logs đều hoạt động.
- [ ] Có thể xác định chính xác source commit từ image đang chạy.

### Rủi ro và rollback

- Nếu task không healthy, xem ECS events và CloudWatch logs trước khi thay đổi security group.
- Rollback bằng cách cập nhật service về task definition revision/image SHA healthy gần nhất.
- Không mở Atlas cho `0.0.0.0/0` để xử lý tạm lỗi kết nối.

---

## Giai đoạn 5 — Thiết lập GitHub CI/CD

### Mục tiêu

Tự động kiểm tra mọi thay đổi và tự động deploy bản hợp lệ khi nhánh `master` cập nhật mà không lưu AWS access key dài hạn.

### Điều kiện bắt đầu

- Deployment thủ công ở giai đoạn 4 đã thành công.
- GitHub repository cho phép cấu hình Actions, Environments và branch protection.

### Checklist đầu việc

- [ ] Tạo workflow CI chạy trên pull request và push.
- [ ] CI thực hiện install từ lockfile, lint, build, test và Docker build validation.
- [ ] Tạo GitHub Environment `production` và cấu hình approval phù hợp.
- [ ] Tạo AWS IAM OIDC provider cho GitHub Actions.
- [ ] Tạo deploy role với trust policy giới hạn đúng repository, branch `master` và production environment.
- [ ] Tạo Terraform role riêng, không dùng chung application deploy role.
- [ ] Tạo workflow deploy chỉ chạy sau khi CI thành công trên `master`.
- [ ] Build image một lần, tag bằng full Git SHA và push ECR.
- [ ] Cập nhật ECS task definition bằng image SHA/digest.
- [ ] Deploy ECS service, chờ service stable và chạy smoke test `/health`.
- [ ] Workflow phải fail nếu image scan policy, deployment hoặc smoke test thất bại.
- [ ] Tạo Terraform workflow chạy fmt/validate/plan trên pull request.
- [ ] Terraform apply chỉ chạy từ `master` thông qua production approval.
- [ ] Bật branch protection yêu cầu CI pass trước khi merge.
- [ ] Ghi hướng dẫn rollback workflow về image SHA/task revision trước.

### Tài nguyên liên quan

- GitHub Actions workflows.
- GitHub Environment và branch protection.
- AWS IAM OIDC provider và roles.
- ECR, ECS và Terraform state bucket.

### Cách kiểm tra

- [ ] Pull request lỗi lint/build bị chặn.
- [ ] Pull request hợp lệ tạo Terraform plan nhưng không apply.
- [ ] Merge vào `master` tạo image mang đúng commit SHA.
- [ ] ECS deploy revision mới và service trở lại stable.
- [ ] Workflow không chứa AWS access key dài hạn.
- [ ] Workflow từ branch không được phép không thể assume production role.

### Tiêu chí hoàn thành

- [ ] Push hợp lệ lên `master` tự động triển khai tới ECS.
- [ ] Mọi image đang chạy truy vết được về Git commit.
- [ ] CI/CD có least-privilege OIDC và production approval.
- [ ] Có quy trình rollback được ghi chép và thử nghiệm ở giai đoạn 7.

### Rủi ro và rollback

- Workflow sai có thể deploy nhầm image; luôn deploy SHA/digest, không dựa duy nhất vào `latest`.
- Thu hồi hoặc disable deploy role khi phát hiện trust policy sai.
- Rollback bằng task definition revision trước, không rebuild source cũ dưới tag mới.

---

## Giai đoạn 6 — Domain, HTTPS và smoke test

### Mục tiêu

Công khai API qua domain ổn định, HTTPS/WSS hợp lệ và cho phép frontend Vercel sử dụng cookie an toàn.

### Điều kiện bắt đầu

- CI/CD đã deploy backend ổn định.
- Có quyền cập nhật DNS tại nhà cung cấp domain hiện tại.

### Checklist đầu việc

- [ ] Chốt hostname `api.<domain>` và ghi vào bảng thông tin triển khai.
- [ ] Yêu cầu ACM public certificate tại `ap-southeast-1`.
- [ ] Lấy ACM DNS validation CNAME từ Terraform output.
- [ ] Thêm validation record tại DNS provider và chờ certificate chuyển sang `Issued`.
- [ ] Tạo ALB HTTPS listener port `443` gắn ACM certificate.
- [ ] Cấu hình listener port `80` redirect vĩnh viễn sang HTTPS.
- [ ] Thêm DNS record `api.<domain>` trỏ tới ALB theo khả năng CNAME/ALIAS/ANAME của provider.
- [ ] Cập nhật `ALLOWED_ORIGINS` với Vercel production URL và frontend custom domain nếu có.
- [ ] Cập nhật frontend API/WebSocket base URL sang HTTPS/WSS production URL.
- [ ] Redeploy task nếu cấu hình environment thay đổi.
- [ ] Kiểm tra certificate chain, hostname và thời hạn hợp lệ.

### Tài nguyên liên quan

- External DNS provider.
- ACM certificate.
- ALB HTTP/HTTPS listeners.
- Backend `ALLOWED_ORIGINS` và frontend API base URL.

### Cách kiểm tra

- [ ] `http://api.<domain>` redirect sang HTTPS.
- [ ] `https://api.<domain>/health` trả `200` với certificate hợp lệ.
- [ ] FE Vercel login và gửi cookie `Secure`, `SameSite=None` thành công.
- [ ] Refresh token flow hoạt động.
- [ ] Socket.IO kết nối qua `wss://` và giữ kết nối ổn định.
- [ ] Origin không hợp lệ bị CORS từ chối.
- [ ] Không gọi API qua ALB HTTP endpoint trong cấu hình frontend production.

### Tiêu chí hoàn thành

- [ ] REST API và WebSocket chỉ được frontend gọi qua HTTPS/WSS production domain.
- [ ] Cookie authentication, CORS và refresh token hoạt động end-to-end.
- [ ] HTTP tự động redirect và TLS certificate hợp lệ.

### Rủi ro và rollback

- DNS propagation có thể kéo dài; giữ ALB endpoint để kiểm tra kỹ thuật nhưng không dùng nó làm production API URL.
- Nếu CORS làm gián đoạn FE, rollback task definition/config revision trước thay vì mở wildcard origin.
- Nếu certificate chưa issued, không bỏ qua HTTPS bằng cách hạ bảo mật cookie.

---

## Giai đoạn 7 — Monitoring và rollback test

### Mục tiêu

Đảm bảo hệ thống có tín hiệu vận hành, cảnh báo chi phí và quy trình phục hồi đã được kiểm chứng.

### Điều kiện bắt đầu

- Production domain và HTTPS hoạt động.
- CI/CD đã deploy được ít nhất một revision thành công.

### Checklist đầu việc

- [ ] Tạo CloudWatch alarm cho ALB unhealthy target.
- [ ] Tạo alarm cho ALB HTTP 5xx và target 5xx vượt ngưỡng.
- [ ] Tạo alarm khi ECS running task count thấp hơn desired count.
- [ ] Tạo alarm CPU và memory cao kéo dài.
- [ ] Theo dõi task restart/deployment failure qua ECS events hoặc EventBridge/SNS.
- [ ] Tạo CloudWatch dashboard cho request count, latency, 4xx/5xx, CPU, memory và task health.
- [ ] Cấu hình kênh nhận alarm phù hợp và xác minh subscription.
- [ ] Xác minh AWS Budget gửi cảnh báo thực tế và dự báo.
- [ ] Xác minh MongoDB Atlas backup policy phù hợp với tier đang dùng.
- [ ] Thực hiện restore test trên database/cluster không phải production khi tier cho phép.
- [ ] Deploy có kiểm soát một image không vượt qua health check.
- [ ] Xác nhận ECS deployment circuit breaker tự rollback.
- [ ] Thực hiện rollback thủ công về task definition revision trước.
- [ ] Xác nhận API, Agenda và Socket.IO hoạt động sau rollback.
- [ ] Viết runbook cho deployment lỗi, task crash, Atlas mất kết nối, certificate/DNS lỗi và chi phí bất thường.

### Tài nguyên liên quan

- CloudWatch Metrics, Logs, Alarms và Dashboard.
- ECS deployment circuit breaker.
- SNS/EventBridge nếu dùng để gửi cảnh báo.
- AWS Budgets và MongoDB Atlas backup.

### Cách kiểm tra

- [ ] Kích hoạt thử từng alarm không phá hoại và nhận được thông báo.
- [ ] Dashboard hiển thị dữ liệu thật từ ALB/ECS.
- [ ] Deployment lỗi không thay thế revision healthy cuối cùng.
- [ ] Rollback thủ công hoàn tất trong thời gian chấp nhận được.
- [ ] Runbook đủ để một người khác thực hiện mà không cần biết secret.

### Tiêu chí hoàn thành

- [ ] Các failure quan trọng có alarm và người nhận rõ ràng.
- [ ] Automatic rollback và manual rollback đều đã được kiểm chứng.
- [ ] Backup/restore responsibility được xác định rõ.
- [ ] Có tài liệu vận hành và kiểm soát chi phí.

### Rủi ro và rollback

- Chỉ thực hiện failure injection trong khung thời gian có giám sát.
- Không thử restore đè lên production database.
- Sau rollback test, xác nhận task definition, image SHA và source revision đang chạy là bản mong muốn.

---

## Checklist nghiệm thu cuối cùng

### Application và container

- [ ] Source lint, build và test thành công.
- [ ] Production image chạy bằng non-root user và không chứa secret.
- [ ] Health check và graceful shutdown hoạt động.
- [ ] Redis chưa được yêu cầu; ứng dụng chạy với `CACHE_ENABLED=false`.

### AWS infrastructure

- [ ] Hạ tầng có thể tái tạo bằng Terraform.
- [ ] ECS task ở private subnet và không có public IP.
- [ ] ALB là entry point công khai duy nhất của backend.
- [ ] MongoDB Atlas chỉ cho phép NAT Elastic IP của deployment.
- [ ] IAM và security groups tuân thủ least privilege.

### CI/CD

- [ ] Pull request bắt buộc vượt qua CI.
- [ ] Push hợp lệ lên `master` tự build, push ECR và deploy ECS.
- [ ] GitHub Actions sử dụng OIDC, không dùng access key dài hạn.
- [ ] Image production được tag bằng Git SHA/digest và truy vết được.

### HTTPS, frontend và realtime

- [ ] API hoạt động tại `https://api.<domain>`.
- [ ] HTTP redirect sang HTTPS và ACM certificate hợp lệ.
- [ ] FE Vercel gọi REST API kèm cookie thành công.
- [ ] Refresh token và CORS hoạt động đúng.
- [ ] Socket.IO hoạt động qua WSS.

### Database và background jobs

- [ ] CRUD và transaction MongoDB quan trọng hoạt động trên Atlas.
- [ ] Agenda khởi động một lần và xử lý job thành công.
- [ ] Atlas backup policy đã được xác minh.

### Vận hành

- [ ] CloudWatch logs, dashboard và alarms hoạt động.
- [ ] AWS Budget alerts đã bật.
- [ ] ECS automatic rollback đã được kiểm tra.
- [ ] Manual rollback về image/task revision trước đã được kiểm tra.
- [ ] Runbook sự cố và thông tin triển khai không nhạy cảm đã được cập nhật.

## Các hạng mục ngoài phạm vi phase đầu

- Redis/ElastiCache và cache production.
- Scale backend lên nhiều ECS task.
- Tách Agenda thành worker service riêng.
- Socket.IO Redis adapter cho nhiều task.
- Chuyển frontend khỏi Vercel.
- Multi-region hoặc disaster recovery tự động.

Các hạng mục này chỉ bắt đầu sau khi deployment một task ổn định, monitoring đủ dữ liệu và chi phí thực tế đã được đánh giá.
