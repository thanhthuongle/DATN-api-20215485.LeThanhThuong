locals {
  public_subnets = {
    for index, az in var.availability_zones : az => {
      cidr = var.public_subnet_cidrs[index]
    }
  }

  private_subnets = {
    for index, az in var.availability_zones : az => {
      cidr = var.private_subnet_cidrs[index]
    }
  }
}

resource "aws_subnet" "public" {
  for_each = local.public_subnets

  vpc_id                  = aws_vpc.main.id
  availability_zone       = each.key
  cidr_block              = each.value.cidr
  map_public_ip_on_launch = false

  tags = {
    Name = "heymoney-production-public-${each.key}"
    Tier = "public"
  }
}

resource "aws_subnet" "private" {
  for_each = local.private_subnets

  vpc_id                  = aws_vpc.main.id
  availability_zone       = each.key
  cidr_block              = each.value.cidr
  map_public_ip_on_launch = false

  tags = {
    Name = "heymoney-production-private-${each.key}"
    Tier = "private"
  }
}
