resource "aws_ecs_service" "api" {
  name            = "heymoney-production-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.ecs_desired_count

  enable_ecs_managed_tags = true
  enable_execute_command  = false
  propagate_tags          = "SERVICE"

  health_check_grace_period_seconds = 90

  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  capacity_provider_strategy {
    capacity_provider = "FARGATE"
    base              = 1
    weight            = 1
  }

  network_configuration {
    subnets = [
      for az in var.availability_zones : aws_subnet.private[az].id
    ]

    security_groups = [
      aws_security_group.ecs.id
    ]

    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = var.container_port
  }

  depends_on = [
    aws_lb_listener.http,
    aws_ecs_cluster_capacity_providers.main
  ]

  lifecycle {
    ignore_changes = [
      task_definition
    ]
  }

  tags = {
    Name = "heymoney-production-api"
  }
}
