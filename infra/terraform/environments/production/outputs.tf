output "vpc_id" {
  description = "Production VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs keyed by Availability Zone"
  value = {
    for az, subnet in aws_subnet.public : az => subnet.id
  }
}

output "private_subnet_ids" {
  description = "Private subnet IDs keyed by Availability Zone"
  value = {
    for az, subnet in aws_subnet.private : az => subnet.id
  }
}

output "nat_elastic_ip" {
  description = "Static outbound IP that must be whitelisted in MongoDB Atlas"
  value       = aws_eip.nat.public_ip
}

output "ecr_repository_url" {
  description = "ECR repository URL for the API image"
  value       = aws_ecr_repository.api.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.api.name
}

output "ecs_task_definition_family" {
  description = "ECS task definition family"
  value       = aws_ecs_task_definition.api.family
}

output "alb_dns_name" {
  description = "Public DNS name of the application load balancer"
  value       = aws_lb.api.dns_name
}

output "alb_arn" {
  description = "Application load balancer ARN"
  value       = aws_lb.api.arn
}

output "target_group_arn" {
  description = "API target group ARN"
  value       = aws_lb_target_group.api.arn
}

output "cloudwatch_log_group_name" {
  description = "CloudWatch log group used by the API"
  value       = aws_cloudwatch_log_group.api.name
}

output "application_secret_names" {
  description = "Secrets Manager names that require values before deployment"
  value       = local.application_secret_names
}
