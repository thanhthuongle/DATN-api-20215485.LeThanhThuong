resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name = "heymoney-production-nat-eip"
  }
}

resource "aws_nat_gateway" "main" {
  allocation_id     = aws_eip.nat.id
  subnet_id         = aws_subnet.public[var.availability_zones[0]].id
  connectivity_type = "public"

  depends_on = [
    aws_internet_gateway.main
  ]

  tags = {
    Name = "heymoney-production-nat"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name = "heymoney-production-private-rt"
    Tier = "private"
  }
}

resource "aws_route_table_association" "private" {
  for_each = aws_subnet.private

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private.id
}
