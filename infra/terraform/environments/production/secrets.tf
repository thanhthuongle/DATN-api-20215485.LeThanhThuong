locals {
  application_secret_names = {
    MONGODB_URI_PRODUCTION         = "heymoney/production/mongodb-uri"
    ACCESS_TOKEN_SECRET_SIGNATURE  = "heymoney/production/access-token-secret"
    REFRESH_TOKEN_SECRET_SIGNATURE = "heymoney/production/refresh-token-secret"
    BREVO_API_KEY                  = "heymoney/production/brevo-api-key"
    CLOUDINARY_API_KEY             = "heymoney/production/cloudinary-api-key"
    CLOUDINARY_API_SECRET          = "heymoney/production/cloudinary-api-secret"
  }
}

resource "aws_secretsmanager_secret" "application" {
  for_each = local.application_secret_names

  name                    = each.value
  description             = "Production secret for ${each.key}"
  recovery_window_in_days = 7

  tags = {
    Name        = each.value
    Environment = "production"
  }
}