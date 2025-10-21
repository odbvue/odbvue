# ATP Module Variables

variable "compartment_ocid" {
  description = "The OCID of the compartment where the ATP database will be created"
  type        = string
}

variable "db_name" {
  description = "The database name for the ATP instance (alphanumeric, max 14 chars)"
  type        = string
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9]*$", var.db_name)) && length(var.db_name) <= 14
    error_message = "Database name must be alphanumeric, start with a letter, and be max 14 characters."
  }
}

variable "display_name" {
  description = "The user-friendly display name for the ATP instance"
  type        = string
}

variable "cpu_core_count" {
  description = "The number of OCPU cores to enable for the ATP instance"
  type        = number
  default     = 1
  validation {
    condition     = var.cpu_core_count >= 0 && var.cpu_core_count <= 128
    error_message = "CPU core count must be between 0 (for Always Free) and 128."
  }
}

variable "data_storage_tbs" {
  description = "The size, in terabytes, of the data volume that will be created and attached to the database"
  type        = number
  default     = 1
  validation {
    condition     = var.data_storage_tbs >= 1 && var.data_storage_tbs <= 384
    error_message = "Data storage size must be between 1 and 384 TB."
  }
}

variable "db_version" {
  description = "A valid Oracle Database version for Autonomous Database"
  type        = string
  default     = "19c"
  validation {
    condition     = contains(["19c", "21c", "23c"], var.db_version)
    error_message = "Database version must be one of: 19c, 21c, 23c."
  }
}

variable "license_model" {
  description = "The Oracle license model that applies to the Oracle Autonomous Database"
  type        = string
  default     = "LICENSE_INCLUDED"
  validation {
    condition     = contains(["LICENSE_INCLUDED", "BRING_YOUR_OWN_LICENSE"], var.license_model)
    error_message = "License model must be either LICENSE_INCLUDED or BRING_YOUR_OWN_LICENSE."
  }
}

variable "is_free_tier" {
  description = "Indicates if this is an Always Free resource"
  type        = bool
  default     = true
}

variable "is_auto_scaling_enabled" {
  description = "Indicates if auto scaling is enabled for the Autonomous Database OCPU core count"
  type        = bool
  default     = false
}

variable "admin_password" {
  description = "The password must be between 12 and 30 characters long, and must contain at least 1 uppercase, 1 lowercase, and 1 numeric character"
  type        = string
  sensitive   = true
}

variable "whitelisted_ips" {
  description = "The client IP access control list (ACL). If null, all IPs are allowed"
  type        = list(string)
  default     = null
}

variable "is_data_guard_enabled" {
  description = "Indicates whether to enable the Autonomous Data Guard"
  type        = bool
  default     = false
}

variable "maintenance_schedule_type" {
  description = "The maintenance schedule type of the Autonomous Database on shared Exadata infrastructure"
  type        = string
  default     = "REGULAR"
  validation {
    condition     = contains(["EARLY", "REGULAR"], var.maintenance_schedule_type)
    error_message = "Maintenance schedule type must be either EARLY or REGULAR."
  }
}

variable "environment" {
  description = "Environment name (e.g., test, prod)"
  type        = string
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "generate_wallet" {
  description = "Whether to generate a wallet for the ATP database"
  type        = bool
  default     = true
}

variable "wallet_password" {
  description = "The password to encrypt the wallet"
  type        = string
  sensitive   = true
  default     = null
}