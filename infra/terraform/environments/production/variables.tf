variable "budget_limit_usd" {
  description = "Monthly AWS cost budget in USD"
  type        = number
  default     = 50

  validation {
    condition     = var.budget_limit_usd > 0
    error_message = "The monthly budget must be greater than 0 USD."
  }
}

variable "budget_notification_email" {
  description = "Email address that receives AWS Budget notifications"
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.budget_notification_email))
    error_message = "The budget notification email must be a valid email address."
  }
}
