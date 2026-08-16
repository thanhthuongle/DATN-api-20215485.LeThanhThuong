terraform {
  backend "s3" {
    bucket       = "heymoney-terraform-state-232499238146-ap-southeast-1"
    key          = "bootstrap/terraform.tfstate"
    region       = "ap-southeast-1"
    encrypt      = true
    use_lockfile = true
  }
}
