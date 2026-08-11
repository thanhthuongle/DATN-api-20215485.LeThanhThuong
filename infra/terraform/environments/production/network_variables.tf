variable "vpc_cidr" {
  description = "CIDR block for the production VPC"
  type        = string
  default     = "10.20.0.0/16"

  validation {
    condition     = can(cidrnetmask(var.vpc_cidr))
    error_message = "vpc_cidr must be a valid IPv4 CIDR block."
  }
}

variable "availability_zones" {
  description = "Availability Zones used by public and private subnets"
  type        = list(string)

  default = [
    "ap-southeast-1a",
    "ap-southeast-1b"
  ]

  validation {
    condition = (
      length(var.availability_zones) == 2 &&
      length(distinct(var.availability_zones)) == 2
    )
    error_message = "Exactly two distinct Availability Zones must be provided."
  }
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for the two public subnets"
  type        = list(string)

  default = [
    "10.20.0.0/24",
    "10.20.1.0/24"
  ]

  validation {
    condition = (
      length(var.public_subnet_cidrs) == 2 &&
      alltrue([
        for cidr in var.public_subnet_cidrs : can(cidrnetmask(cidr))
      ])
    )
    error_message = "Exactly two valid public subnet CIDRs must be provided."
  }
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for the two private subnets"
  type        = list(string)

  default = [
    "10.20.10.0/24",
    "10.20.11.0/24"
  ]

  validation {
    condition = (
      length(var.private_subnet_cidrs) == 2 &&
      alltrue([
        for cidr in var.private_subnet_cidrs : can(cidrnetmask(cidr))
      ])
    )
    error_message = "Exactly two valid private subnet CIDRs must be provided."
  }
}
