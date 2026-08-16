output "terraform_state_bucket_name" {
  description = "Name of the S3 bucket used for Terraform remote state"
  value       = aws_s3_bucket.terraform_state.id
}

output "terraform_state_bucket_arn" {
  description = "ARN of the S3 bucket used for Terraform remote state"
  value       = aws_s3_bucket.terraform_state.arn
}

output "aws_account_id" {
  description = "AWS account that owns the Terraform state bucket"
  value       = data.aws_caller_identity.current.account_id
}

output "aws_region" {
  description = "AWS region containing the Terraform state bucket"
  value       = "ap-southeast-1"
}
