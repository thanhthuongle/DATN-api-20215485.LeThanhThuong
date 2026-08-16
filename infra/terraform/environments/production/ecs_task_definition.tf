locals {
  container_environment = {
    AUTHOR                    = "Le Thanh Thuong - 20215485"
    NODE_ENV                  = "production"
    BUILD_MODE                = "production"
    PORT                      = tostring(var.container_port)
    DATABASE_NAME             = var.database_name
    CORS_ALLOWED_ORIGINS      = join(",", var.cors_allowed_origins)
    ACCESS_TOKEN_LIFE         = var.access_token_life
    REFRESH_TOKEN_LIFE        = var.refresh_token_life
    ADMIN_EMAIL_ADDRESS       = var.admin_email_address
    ADMIN_EMAIL_NAME          = var.admin_email_name
    CLOUDINARY_CLOUD_NAME     = var.cloudinary_cloud_name
    CACHE_ENABLED             = "false"
    CACHE_DEFAULT_TTL         = "3600"
    CACHE_TTL_BANKS           = "86400"
    CACHE_TTL_CATEGORIES      = "3600"
    CACHE_TTL_ACCOUNTS        = "3600"
    WEBSITE_DOMAIN_PRODUCTION = var.website_domain_production
  }

  container_secrets = {
    for environment_name, secret in aws_secretsmanager_secret.application :
    environment_name => secret.arn
  }
}

resource "aws_ecs_task_definition" "api" {
  family                   = "heymoney-production-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = tostring(var.task_cpu)
  memory                   = tostring(var.task_memory)
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = "${aws_ecr_repository.api.repository_url}:${var.container_image_tag}"
      essential = true
      user      = "node"

      portMappings = [
        {
          name          = "api-http"
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        for name, value in local.container_environment : {
          name  = name
          value = value
        }
      ]

      secrets = [
        for name, value_from in local.container_secrets : {
          name      = name
          valueFrom = value_from
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"

        options = {
          awslogs-group         = aws_cloudwatch_log_group.api.name
          awslogs-region        = "ap-southeast-1"
          awslogs-stream-prefix = "api"
        }
      }

      healthCheck = {
        command = [
          "CMD-SHELL",
          "node -e \"fetch('http://127.0.0.1:' + (process.env.PORT || 8017) + '/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))\""
        ]

        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 20
      }

      linuxParameters = {
        initProcessEnabled = true
      }

      stopTimeout = 30
    }
  ])

  depends_on = [
    aws_iam_role_policy_attachment.ecs_execution_managed,
    aws_iam_role_policy.ecs_execution_secrets
  ]

  tags = {
    Name = "heymoney-production-api"
  }
}
