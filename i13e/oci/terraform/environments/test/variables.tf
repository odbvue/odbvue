# Test Environment Variables

# OCI Configuration
variable "region" {
  description = "OCI Region"
  type        = string
  default     = "eu-frankfurt-1"
}

variable "compartment_ocid" {
  description = "OCID of the compartment where resources will be created"
  type        = string
}

# ATP Configuration
variable "db_name" {
  description = "Database name (alphanumeric, max 14 chars)"
  type        = string
  default     = "OdbVue"
}

variable "display_name" {
  description = "Display name for the ATP instance"
  type        = string
  default     = "OdbVue"
}

variable "cpu_core_count" {
  description = "Number of OCPU cores"
  type        = number
  default     = 1
}

variable "data_storage_tbs" {
  description = "Data storage size in TB"
  type        = number
  default     = 1
}

variable "db_version" {
  description = "Oracle Database version"
  type        = string
  default     = "19c"
}

variable "license_model" {
  description = "Oracle license model"
  type        = string
  default     = "LICENSE_INCLUDED"
}

variable "is_free_tier" {
  description = "Enable free tier"
  type        = bool
  default     = true
}

variable "is_auto_scaling_enabled" {
  description = "Enable auto scaling"
  type        = bool
  default     = false
}

# Security
variable "admin_password" {
  description = "Database admin password"
  type        = string
  sensitive   = true
}

variable "whitelisted_ips" {
  description = "List of whitelisted IP addresses"
  type        = list(string)
  default     = null
}

# Wallet
variable "generate_wallet" {
  description = "Generate database wallet"
  type        = bool
  default     = true
}

variable "wallet_password" {
  description = "Wallet encryption password"
  type        = string
  sensitive   = true
  default     = null
}

# Tags
variable "common_tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    "Project"   = "OdbVue"
    "CreatedBy" = "terraform"
  }
}