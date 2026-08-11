resource "aws_security_group" "alb" {
  name        = "heymoney-production-alb-sg"
  description = "Controls public access to the application load balancer"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "heymoney-production-alb-sg"
  }
}

resource "aws_security_group" "ecs" {
  name        = "heymoney-production-ecs-sg"
  description = "Allows application traffic only from the load balancer"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "heymoney-production-ecs-sg"
  }
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id

  description = "Public HTTP access"
  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "tcp"
  from_port   = 80
  to_port     = 80
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id

  description = "Public HTTPS access"
  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "tcp"
  from_port   = 443
  to_port     = 443
}

resource "aws_vpc_security_group_egress_rule" "alb_to_ecs" {
  security_group_id = aws_security_group.alb.id

  description                  = "Forward application traffic to ECS"
  referenced_security_group_id = aws_security_group.ecs.id
  ip_protocol                  = "tcp"
  from_port                    = 8017
  to_port                      = 8017
}

resource "aws_vpc_security_group_ingress_rule" "ecs_from_alb" {
  security_group_id = aws_security_group.ecs.id

  description                  = "Accept application traffic from ALB only"
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = 8017
  to_port                      = 8017
}

resource "aws_vpc_security_group_egress_rule" "ecs_outbound" {
  security_group_id = aws_security_group.ecs.id

  description = "Allow outbound access through NAT Gateway"
  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"
}
