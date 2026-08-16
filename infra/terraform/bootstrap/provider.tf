provider "aws" {
  region = "ap-southeast-1"

  default_tags {
    tags = {
      Project     = "HeyMoney"
      Environment = "bootstrap"
      ManagedBy   = "Terraform"
    }
  }
}
