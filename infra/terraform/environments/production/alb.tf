resource "aws_lb" "api" {
  name               = "heymoney-production-alb"
  internal           = false
  load_balancer_type = "application"

  subnets = [
    for az in var.availability_zones : aws_subnet.public[az].id
  ]

  security_groups = [
    aws_security_group.alb.id
  ]

  enable_deletion_protection = false
  drop_invalid_header_fields = true
  enable_http2               = true
  idle_timeout               = 120

  tags = {
    Name = "heymoney-production-alb"
  }
}

resource "aws_lb_target_group" "api" {
  name        = "heymoney-production-api"
  port        = 8017
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  deregistration_delay = 30

  health_check {
    enabled             = true
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name = "heymoney-production-api-tg"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}
