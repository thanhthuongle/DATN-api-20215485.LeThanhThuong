resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/heymoney-production-api"
  retention_in_days = 14
  log_group_class   = "STANDARD"

  tags = {
    Name = "heymoney-production-api-logs"
  }
}
