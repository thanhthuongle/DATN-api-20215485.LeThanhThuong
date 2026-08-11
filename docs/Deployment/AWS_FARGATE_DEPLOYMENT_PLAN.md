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
|    1 | Tinh chỉnh source                     | `Hoàn thành`     |         |
|    2 | Docker build và kiểm thử local        | `Hoàn thành`     |         |
|    3 | Tạo AWS infrastructure bằng Terraform | `Hoàn thành`     |         |
|    4 | Deploy thủ công lần đầu               | `Đang thực hiện` |         |
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
- [X] Backend bắt đầu với một ECS task (`desired_count=1`) `sau khi image đầu tiên được deploy ở Giai đoạn 4.`
- [X] Agenda tiếp tục chạy chung với API trong giai đoạn đầu.
- [X] Frontend tiếp tục chạy trên Vercel.
- [X] Application Load Balancer xử lý HTTPS, WebSocket và chuyển tiếp request tới ECS; không thêm Nginx vào backend.

## Thông tin triển khai cần ghi nhận

> Chỉ ghi identifier, hostname và ARN không nhạy cảm. Không ghi secret hoặc connection string.

| Thông tin                         | Giá trị                                                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| AWS Account ID                    | `232499238146`                                                                                                       |
| AWS Region                        | `ap-southeast-1`                                                                                                     |
| Terraform state bucket            | `heymoney-terraform-state-232499238146-ap-southeast-1`                                                               |
| API domain                        | `api.<your-domain>`                                                                                                  |
| MongoDB Atlas region              | `HONG KONG (ap-east-1)`                                                                                              |
| ECR repository                    | `232499238146.dkr.ecr.ap-southeast-1.amazonaws.com/heymoney-api`                                                     |
| ECS cluster                       | `heymoney-production`                                                                                                |
| ECS service                       | `heymoney-production-api`                                                                                            |
| ECS task definition family        | `heymoney-production-api`                                                                                            |
| ALB DNS name                      | `heymoney-production-alb-25405697.ap-southeast-1.elb.amazonaws.com`                                                  |
| ALB ARN                           | `arn:aws:elasticloadbalancing:ap-southeast-1:232499238146:loadbalancer/app/heymoney-production-alb/49892853bcfb1051` |
| Target group ARN                  | `arn:aws:elasticloadbalancing:ap-southeast-1:232499238146:targetgroup/heymoney-production-api/afe975ac6b8cf7d6`      |
| NAT Elastic IP                    | `52.77.112.105`                                                                                                      |
| ACM certificate ARN               | `TBD`                                                                                                                |
| CloudWatch log group              | `/ecs/heymoney-production-api`                                                                                       |
| GitHub Actions deploy role ARN    | `TBD`                                                                                                                |
| GitHub Actions Terraform role ARN | `TBD`                                                                                                                |

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

- [X] Tạo multi-stage `Dockerfile` sử dụng Node.js LTS với version được pin rõ ràng.
- [X] Cài dependencies từ lockfile bằng chế độ immutable/frozen.
- [X] Build Babel ở build stage.
- [X] Runtime stage chỉ chứa build output và production dependencies.
- [X] Tạo non-root user và chạy ứng dụng bằng user này.
- [X] Expose port `8017` và khai báo Docker health check gọi `/health`.
- [X] Tạo `.dockerignore` loại trừ `.env`, `.git`, `node_modules`, coverage, cache, log và tài liệu không cần thiết.
- [X] Không bake biến môi trường hoặc secret production vào image.
- [X] Gắn OCI labels tối thiểu cho source revision và repository.
- [X] Build image local với tag Git SHA.
- [X] Chạy container bằng file env local ngoài image.
- [X] Kiểm tra image history/layers không chứa secret.
- [X] Ghi lại command build, run và smoke test trong tài liệu dự án.

### Tài nguyên liên quan

- `Dockerfile` production.
- `.dockerignore`.
- Docker Engine/Docker Desktop local.
- MongoDB Atlas development hoặc database test có hỗ trợ replica set.

### Cách kiểm tra

- [X] Docker build thành công từ clean checkout.
  Lệnh build image local: docker build --build-arg "SOURCE_REPOSITORY=$(git rev-parse master)" --build-arg "SOURCE_REVISION=$(git rev-parse master)" -t TAGNAME .
- [X] Container chạy bằng non-root user.
  docker run -d --name containerName --env-file env-path -p 8017:8017 --restart unless-stopped imageName:imageTag
- [X] `/health` trả `200` qua mapped port.
- [X] Login/API cơ bản và Socket.IO hoạt động từ container.
- [X] Agenda khởi động đúng một lần.
- [X] Ứng dụng hoạt động khi không có `REDIS_URL` và `CACHE_ENABLED=false`.
- [X] Dừng container và xác nhận graceful shutdown xuất hiện trong log.

### Tiêu chí hoàn thành

- [X] Image có thể build và chạy độc lập trên máy khác chỉ với Docker và biến môi trường hợp lệ.
- [X] Không có secret trong image hoặc build log.
- [X] Smoke test container thành công.

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

- [X] Bootstrap S3 bucket cho Terraform state với encryption, versioning và block public access.
- [X] Bật S3 state locking và tách bootstrap state khỏi production state.
- [X] Pin Terraform và provider versions.
- [X] Tạo VPC tại `ap-southeast-1`.
- [X] Tạo hai public subnet và hai private subnet ở hai Availability Zone.
- [X] Tạo Internet Gateway và route tables phù hợp.
- [X] Tạo một NAT Gateway cùng Elastic IP và route outbound cho private subnets.
- [X] Tạo ALB ở public subnets.
- [X] Tạo ALB security group chỉ nhận HTTP/HTTPS công khai.
- [X] Tạo ECS security group chỉ nhận port `8017` từ ALB security group.
- [X] Tạo private ECR repository với image scanning, encryption và lifecycle policy.
- [X] Tạo ECS cluster, task definition và service sử dụng Fargate.
- [X] Đặt task ở mức `0.25 vCPU/0.5 GB RAM`; giữ `desired_count=0` cho đến khi image Git SHA được push ở Giai đoạn 4, sau đó tăng lên `1`.
- [X] Tắt public IP cho ECS task.
- [X] Tạo target group kiểm tra `GET /health`.
- [X] Bật ECS deployment circuit breaker và automatic rollback.
- [X] Tạo CloudWatch log group với retention 14 ngày.
- [X] Tạo ECS execution role và application task role riêng, áp dụng least privilege.
- [X] Tạo Secrets Manager entries cho MongoDB, JWT, Brevo và Cloudinary secrets; nhập giá trị bằng kênh bảo mật, không đưa vào Terraform state nếu có thể tránh.
- [X] Cấu hình task definition lấy secret trực tiếp từ Secrets Manager.
- [X] Tạo AWS Budget và cảnh báo chi phí thực tế/dự báo.
- [X] Chạy `terraform fmt -check`, `validate` và review `plan` trước khi apply.
- [X] Apply hạ tầng và ghi identifier không nhạy cảm vào bảng thông tin triển khai.
- [X] Whitelist NAT Elastic IP trong MongoDB Atlas Network Access.

### Tài nguyên liên quan

- Terraform state S3 bucket.
- VPC, subnets, route tables, Internet Gateway, NAT Gateway và Elastic IP.
- ECR, ECS cluster/service/task definition.
- ALB, listeners, target group và security groups.
- CloudWatch, IAM, Secrets Manager và AWS Budget.
- MongoDB Atlas Network Access list.

### Cách kiểm tra

- [X] `terraform plan` sau apply không còn thay đổi ngoài dự kiến.
- [X] ECS task không có public IP.
- [X] ECS security group không nhận traffic trực tiếp từ Internet.
- [X] ECR không public và image scanning được bật.
- [X] NAT Elastic IP là IP duy nhất được Atlas cho phép từ AWS deployment.
- [X] IAM role không có wildcard permission không cần thiết.
- [X] CloudWatch log group và Budget alarm tồn tại.

### Tiêu chí hoàn thành

- [X] Hạ tầng được tạo hoàn toàn từ Terraform.
- [X] Network, IAM, logging và secret injection đã sẵn sàng cho deployment.
- [X] Atlas đã whitelist NAT Elastic IP.
- [X] Terraform state được lưu an toàn và có versioning.

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

- [X] Đăng nhập Docker vào ECR bằng credential ngắn hạn.
- [X] Build image từ commit đã xác định.
- [X] Tag image bằng full Git SHA và push lên ECR.
- [X] Kiểm tra kết quả ECR image scan trước khi deploy.
- [X] Tạo task definition revision tham chiếu image SHA/digest.
- [X] Cập nhật ECS service và chờ service stable.
- [X] Kiểm tra task pull image và inject secret thành công.
- [X] Kiểm tra target chuyển sang healthy.
- [X] Kiểm tra CloudWatch nhận startup/runtime log.
- [X] Xác nhận ECS kết nối Atlas qua NAT EIP.
- [X] Xác nhận Agenda khởi động một lần và collection job hoạt động.
- [X] Xác nhận Redis không được khởi tạo.
- [X] Ghi task definition revision và image SHA đã deploy.

### Tài nguyên liên quan

- Local Docker CLI và AWS CLI.
- ECR repository.
- ECS task definition/service.
- ALB target group.
- CloudWatch Logs và MongoDB Atlas.

### Cách kiểm tra

- [X] ALB gọi `/health` thành công.
- [X] API đọc/ghi thử nghiệm vào Atlas thành công.
- [X] Một luồng transaction MongoDB quan trọng chạy thành công.
- [X] Agenda tạo/lock/run job thành công.
- [X] Socket.IO handshake và WebSocket upgrade thành công qua ALB.
- [X] Không có secret trong ECS event hoặc CloudWatch log.

### Runbook PowerShell đã kiểm chứng

Chạy từ thư mục gốc repository. Deployment chỉ lấy source từ `origin/master`; không lấy SHA của `master` rồi build bằng working tree của nhánh khác.

#### 1. Chuẩn bị biến và đăng nhập ECR

```powershell
git fetch origin master

$awsRegion = "ap-southeast-1"
$gitSha = git rev-parse origin/master
$awsAccountId = aws sts get-caller-identity --query Account --output text
$ecrRegistry = "$awsAccountId.dkr.ecr.$awsRegion.amazonaws.com"
$ecrRepository = "$ecrRegistry/heymoney-api"
$imageUri = "${ecrRepository}:${gitSha}"
$sourceRepository = "https://github.com/thanhthuongle/DATN-api-20215485.LeThanhThuong"

aws ecr get-login-password --region $awsRegion |
  docker login --username AWS --password-stdin $ecrRegistry
```

#### 2. Build đúng source `master`, push và scan

Tắt provenance/SBOM và xuất `type=docker` để ECR Basic Scanning nhận single-image manifest thay vì OCI image index.

```powershell
docker buildx build `
  --platform linux/amd64 `
  --provenance=false `
  --sbom=false `
  --output type=docker `
  --build-arg "SOURCE_REPOSITORY=$sourceRepository" `
  --build-arg "SOURCE_REVISION=$gitSha" `
  --tag $imageUri `
  "${sourceRepository}.git#$gitSha"

$imageInfo = (docker image inspect $imageUri | ConvertFrom-Json)[0]
[PSCustomObject]@{
  Architecture = $imageInfo.Architecture
  OS           = $imageInfo.Os
  Revision     = $imageInfo.Config.Labels.'org.opencontainers.image.revision'
} | Format-List

docker push $imageUri

$ecrImage = aws ecr describe-images --region $awsRegion `
  --repository-name heymoney-api --image-ids "imageTag=$gitSha" `
  --output json | ConvertFrom-Json
$imageDigest = $ecrImage.imageDetails[0].imageDigest

aws ecr describe-image-scan-findings --region $awsRegion `
  --repository-name heymoney-api --image-id "imageDigest=$imageDigest" `
  --query '{Status:imageScanStatus.status,CompletedAt:imageScanFindings.imageScanCompletedAt,SeverityCounts:imageScanFindings.findingSeverityCounts}' `
  --output json
```

Nếu scan chưa tồn tại, chạy một lần `aws ecr start-image-scan` cho image rồi truy vấn lại bằng digest. Không deploy trước khi review `CRITICAL`/`HIGH` hoặc ghi nhận risk acceptance rõ ràng.

#### 3. Tạo task definition revision nhưng chưa chạy task

```powershell
terraform -chdir=infra/terraform/environments/production plan `
  -var="container_image_tag=$gitSha" -var="ecs_desired_count=0" `
  -out=phase4-taskdef.tfplan

terraform -chdir=infra/terraform/environments/production show `
  -no-color phase4-taskdef.tfplan

terraform -chdir=infra/terraform/environments/production apply `
  phase4-taskdef.tfplan
```

Plan chỉ được thay task definition và cập nhật service trỏ tới revision mới; `desired_count` phải vẫn bằng `0`.

#### 4. Scale service lên một task

```powershell
terraform -chdir=infra/terraform/environments/production plan `
  -var="container_image_tag=$gitSha" -var="ecs_desired_count=1" `
  -out=phase4-scaleup.tfplan

terraform -chdir=infra/terraform/environments/production show `
  -no-color phase4-scaleup.tfplan

terraform -chdir=infra/terraform/environments/production apply `
  phase4-scaleup.tfplan
```

Plan scale-up chỉ được đổi `aws_ecs_service.api.desired_count` từ `0` sang `1`.

#### 5. Kiểm tra ECS, target group, health và log

```powershell
$cluster = terraform -chdir=infra/terraform/environments/production output -raw ecs_cluster_name
$serviceName = terraform -chdir=infra/terraform/environments/production output -raw ecs_service_name
$targetGroupArn = terraform -chdir=infra/terraform/environments/production output -raw target_group_arn
$albDns = terraform -chdir=infra/terraform/environments/production output -raw alb_dns_name
$logGroup = terraform -chdir=infra/terraform/environments/production output -raw cloudwatch_log_group_name

aws ecs describe-services --region $awsRegion --cluster $cluster --services $serviceName `
  --query 'services[0].{Status:status,Desired:desiredCount,Running:runningCount,Pending:pendingCount,TaskDefinition:taskDefinition,RolloutState:deployments[0].rolloutState}' `
  --output json

aws elbv2 describe-target-health --region $awsRegion --target-group-arn $targetGroupArn `
  --query 'TargetHealthDescriptions[].{TargetId:Target.Id,Port:Target.Port,State:TargetHealth.State,Reason:TargetHealth.Reason}' `
  --output table

curl.exe --include --silent --show-error --max-time 20 "http://$albDns/health"

$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"
aws logs tail $logGroup --region $awsRegion --since 30m --format short
```

Log startup phải có kết nối MongoDB, `Agenda started` và server port `8017`; không được có Redis connection attempt hoặc secret value.

#### 6. Smoke test API có cookie qua HTTP tạm thời

Cookie production có `Secure=true`, nên trình duyệt không gửi cookie qua HTTP. Trước Giai đoạn 6 chỉ smoke test bằng cách nạp cookie thủ công vào session; không hạ `Secure=false`.

```powershell
$testEmail = Read-Host "Test account email"
$securePassword = Read-Host "Test account password" -AsSecureString
$testPassword = [System.Net.NetworkCredential]::new("", $securePassword).Password
$loginBody = @{ email = $testEmail; password = $testPassword } | ConvertTo-Json

$loginResponse = Invoke-WebRequest -Uri "http://$albDns/users/login" -Method Post `
  -ContentType "application/json" -Body $loginBody -UseBasicParsing
$loginResult = $loginResponse.Content | ConvertFrom-Json

$testSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$accessCookie = New-Object System.Net.Cookie("accessToken", $loginResult.accessToken, "/", $albDns)
$testSession.Cookies.Add($accessCookie)

Invoke-WebRequest -Uri "http://$albDns/banks" -Method Get `
  -WebSession $testSession -UseBasicParsing
```

Endpoint category ở revision đã deploy cần truyền `q[type]`; gọi không có `q` trả `500`.

```powershell
Invoke-WebRequest `
  -Uri "http://$albDns/categories/individual?q%5Btype%5D=income" `
  -Method Get -WebSession $testSession -UseBasicParsing
```

Smoke test MongoDB transaction dùng amount `0` để không đổi số dư, nhưng vẫn tạo một transaction test thật:

```powershell
$accountsResponse = Invoke-WebRequest -Uri "http://$albDns/accounts/individual" `
  -Method Get -WebSession $testSession -UseBasicParsing
$accounts = $accountsResponse.Content | ConvertFrom-Json

$categoriesResponse = Invoke-WebRequest `
  -Uri "http://$albDns/categories/individual?q%5Btype%5D=income" `
  -Method Get -WebSession $testSession -UseBasicParsing
$categories = $categoriesResponse.Content | ConvertFrom-Json

$smokeName = "DEPLOYMENT_SMOKE_TEST_$(Get-Date -Format yyyyMMdd)"
$transactionBody = @{
  type            = "income"
  categoryId      = [string]$categories[0]._id
  name            = $smokeName
  description     = "AWS manual deployment smoke test"
  amount          = 0
  transactionTime = (Get-Date).ToUniversalTime().ToString("o")
  detailInfo      = @{
    moneyTargetType = "account"
    moneyTargetId   = [string]$accounts[0]._id
  }
} | ConvertTo-Json -Depth 5

$transactionResponse = Invoke-WebRequest `
  -Uri "http://$albDns/transactions/individual" -Method Post `
  -WebSession $testSession -ContentType "application/json" `
  -Body $transactionBody -UseBasicParsing
$transaction = $transactionResponse.Content | ConvertFrom-Json

$detailResponse = Invoke-WebRequest `
  -Uri "http://$albDns/transactions/individual/$($transaction._id)" `
  -Method Get -WebSession $testSession -UseBasicParsing
$persistedTransaction = $detailResponse.Content | ConvertFrom-Json

[PSCustomObject]@{
  CreatedHTTP  = $transactionResponse.StatusCode
  ReadHTTP     = $detailResponse.StatusCode
  IdMatched    = ([string]$persistedTransaction._id) -eq ([string]$transaction._id)
  AmountIsZero = $persistedTransaction.amount -eq 0
  DetailExists = $null -ne $persistedTransaction.detailInfo
} | Format-List
```

#### 7. Smoke test Agenda và Socket.IO

Endpoint sau tạo một notification test thật cho test account:

```powershell
$agendaResponse = Invoke-WebRequest -Uri "http://$albDns/notifications/test" `
  -Method Get -WebSession $testSession -UseBasicParsing

Start-Sleep -Seconds 5
$notificationsResponse = Invoke-WebRequest -Uri "http://$albDns/notifications" `
  -Method Get -WebSession $testSession -UseBasicParsing
$notifications = $notificationsResponse.Content | ConvertFrom-Json
@($notifications | Where-Object { $_.notificationData.title -eq "Test socket" }).Count
```

Kiểm tra WebSocket authenticated handshake bằng .NET `ClientWebSocket`:

```powershell
$socketUri = [Uri]"ws://$albDns/socket.io/?EIO=4&transport=websocket"
$webSocket = [System.Net.WebSockets.ClientWebSocket]::new()
$webSocket.Options.SetRequestHeader("Cookie", "accessToken=$($loginResult.accessToken)")

$connectTimeout = [System.Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds(30))
$webSocket.ConnectAsync($socketUri, $connectTimeout.Token).GetAwaiter().GetResult()

$buffer = New-Object byte[] 8192
$receiveTimeout = [System.Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds(30))
$openResult = $webSocket.ReceiveAsync([ArraySegment[byte]]::new($buffer), $receiveTimeout.Token).GetAwaiter().GetResult()
$openPacket = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $openResult.Count)

$connectBytes = [System.Text.Encoding]::UTF8.GetBytes("40")
$sendTimeout = [System.Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds(30))
$webSocket.SendAsync([ArraySegment[byte]]::new($connectBytes), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $sendTimeout.Token).GetAwaiter().GetResult()

$buffer = New-Object byte[] 8192
$ackTimeout = [System.Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds(30))
$connectResult = $webSocket.ReceiveAsync([ArraySegment[byte]]::new($buffer), $ackTimeout.Token).GetAwaiter().GetResult()
$connectPacket = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $connectResult.Count)

[PSCustomObject]@{
  WebSocketState        = $webSocket.State
  EngineOpenReceived    = $openPacket.StartsWith("0{")
  SocketIOAuthenticated = $connectPacket.StartsWith("40")
} | Format-List

$webSocket.Dispose()
$loginResult = $null
$testPassword = $null
$loginBody = $null
```

#### 8. Xác minh digest runtime và Terraform drift

```powershell
$taskArn = aws ecs list-tasks --region $awsRegion --cluster $cluster `
  --service-name $serviceName --desired-status RUNNING --query 'taskArns[0]' --output text

$runtimeDigest = aws ecs describe-tasks --region $awsRegion --cluster $cluster --tasks $taskArn `
  --query 'tasks[0].containers[0].imageDigest' --output text

[PSCustomObject]@{
  GitSHA        = $gitSha
  ECRDigest     = $imageDigest
  RuntimeDigest = $runtimeDigest
  DigestMatched = $imageDigest -eq $runtimeDigest
} | Format-List

terraform -chdir=infra/terraform/environments/production plan `
  -var="container_image_tag=$gitSha" -var="ecs_desired_count=1" `
  -detailed-exitcode -no-color
```

Terraform phải báo `No changes` và trả exit code `0`.

### Bản ghi deployment thủ công 2026-08-12

- Source Git SHA: `4c2323d03b2c8fd4a55f48adb1f2f5b047b5389f` (`origin/master`).
- ECR/runtime digest: `sha256:5502763278590d4b47b5292ac1763496635593cae82c7ef2f126ef64cb76af4b`.
- ECS task definition: `heymoney-production-api:2`.
- ECR Basic Scan: `3 CRITICAL`, `18 HIGH`, `18 MEDIUM`, `4 LOW`; risk được chấp nhận tạm thời cho lần deploy đồ án này.
- ALB `/health`, Atlas read/write, MongoDB transaction, Agenda và Socket.IO đều đã smoke test thành công.
- Smoke test tạo một transaction amount `0` tên `DEPLOYMENT_SMOKE_TEST_20260812` và một notification `Test socket` trong test account.
- HTTPS chưa cấu hình; cookie `Secure` chỉ được kiểm thử bằng session thủ công. Không hạ bảo mật cookie; hoàn thiện HTTPS ở Giai đoạn 6.
- Ghi nhận bug: `GET /categories/individual` không có `q` trả `500`; response POST transaction có `detailInfo=null` nhưng GET detail trả dữ liệu đúng.

### Tiêu chí hoàn thành

- [X] ECS service stable với một healthy task.
- [X] API, Atlas, Agenda, Socket.IO và logs đều hoạt động.
- [X] Có thể xác định chính xác source commit từ image đang chạy.

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
