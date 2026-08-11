resource "aws_ecs_cluster" "main" {
  name = "heymoney-production"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }

  tags = {
    Name = "heymoney-production"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = [
    "FARGATE"
  ]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    base              = 1
    weight            = 1
  }
}