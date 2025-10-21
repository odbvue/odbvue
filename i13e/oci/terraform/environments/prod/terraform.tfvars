# Production Environment Configuration

# --- Non-sensitive defaults (edit these) ---
region                  = "eu-frankfurt-1"
oci_profile             = "DEFAULT"
compartment_ocid        = "ocid1.tenancy.oc1..aaaaaaaady5lphy6q426xcstqyoz6w24c4vk34iynobqm6bfu5fu45v7dcjq"
db_name                 = "OdbVue"
display_name            = "OdbVue"
cpu_core_count          = 2                   # Higher for production
data_storage_tbs        = 1
license_model           = "LICENSE_INCLUDED"
db_version              = "19c"
is_free_tier            = false               # Production not free tier
is_auto_scaling_enabled = true                # Production can auto scale

# Production-specific settings
is_data_guard_enabled     = true              # High availability for production
maintenance_schedule_type = "REGULAR"

# Wallet configuration
generate_wallet = true

# Security - IP whitelist (restrict access in production)
whitelisted_ips = [
  # Add your office/server IPs here for production
  # "203.0.113.0/24",    # Example office network
  # "198.51.100.50/32"   # Example server IP
]

# Tags
common_tags = {
  "Project"     = "OdbVue"
  "Environment" = "prod"
  "CreatedBy"   = "terraform"
  "Owner"       = "production-team"
  "CriticalData" = "true"
  "Backup"      = "required"
}

# --- Sensitive variables (set via terraform.tfvars.local or environment variables) ---
# admin_password    = "YourSecureProductionPassword123!"
# wallet_password   = "YourProductionWalletPassword123!"