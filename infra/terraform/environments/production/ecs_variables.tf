variable "container_port" {
  description = "Port exposed by the API container"
  type        = number
  default     = 8017

  validation {
    condition     = var.container_port == 8017
    error_message = "The API container port must remain 8017."
  }
}

variable "task_cpu" {
  description = "Fargate task CPU units"
  type        = number
  default     = 256

  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.task_cpu)
    error_message = "task_cpu must be a supported Fargate CPU value."
  }
}

variable "task_memory" {
  description = "Fargate task memory in MiB"
  type        = number
  default     = 512

  validation {
    condition     = var.task_memory >= 512
    error_message = "task_memory must be at least 512 MiB."
  }
}

variable "ecs_desired_count" {
  description = "Number of API tasks requested by the ECS service"
  type        = number
  default     = 0

  validation {
    condition     = contains([0, 1], var.ecs_desired_count)
    error_message = "The initial deployment supports only 0 or 1 ECS task."
  }
}

variable "container_image_tag" {
  description = "Immutable ECR image tag, normally the full Git commit SHA"
  type        = string
  default     = "bootstrap"

  validation {
    condition     = length(trimspace(var.container_image_tag)) > 0
    error_message = "container_image_tag cannot be empty."
  }
}
