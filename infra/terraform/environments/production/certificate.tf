resource "aws_acm_certificate" "api" {
  domain_name       = "api.heymoney.dpdns.org"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "api.heymoney.dpdns.org"
  }
}

resource "aws_acm_certificate_validation" "api" {
  certificate_arn = aws_acm_certificate.api.arn

  validation_record_fqdns = [
    for option in aws_acm_certificate.api.domain_validation_options :
    option.resource_record_name
  ]
}
