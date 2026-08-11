variable "database_name" {
  description = "MongoDB production database name"
  type        = string

  validation {
    condition     = length(trimspace(var.database_name)) > 0
    error_message = "database_name cannot be empty."
  }
}

variable "cors_allowed_origins" {
  description = "Explicit HTTPS origins allowed to call the production API"
  type        = list(string)

  validation {
    condition = (
      length(var.cors_allowed_origins) > 0 &&
      alltrue([
        for origin in var.cors_allowed_origins :
        startswith(origin, "https://") && !endswith(origin, "/")
      ])
    )
    error_message = "Provide at least one HTTPS origin without a trailing slash."
  }
}

variable "access_token_life" {
  description = "Access token lifetime, for example 1h"
  type        = string

  validation {
    condition     = length(trimspace(var.access_token_life)) > 0
    error_message = "access_token_life cannot be empty."
  }
}

variable "refresh_token_life" {
  description = "Refresh token lifetime, for example 30d"
  type        = string

  validation {
    condition     = length(trimspace(var.refresh_token_life)) > 0
    error_message = "refresh_token_life cannot be empty."
  }
}

variable "admin_email_address" {
  description = "Sender or administrator email used by the application"
  type        = string

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.admin_email_address))
    error_message = "admin_email_address must be a valid email address."
  }
}

variable "admin_email_name" {
  description = "Sender display name used by the application"
  type        = string

  validation {
    condition     = length(trimspace(var.admin_email_name)) > 0
    error_message = "admin_email_name cannot be empty."
  }
}

variable "cloudinary_cloud_name" {
  description = "Cloudinary cloud name"
  type        = string

  validation {
    condition     = length(trimspace(var.cloudinary_cloud_name)) > 0
    error_message = "cloudinary_cloud_name cannot be empty."
  }
}

variable "website_domain_production" {
  description = "Production frontend hostname or URL"
  type        = string

  validation {
    condition     = startswith(var.website_domain_production, "https://")
    error_message = "website_domain_production must start with https://."
  }
}
