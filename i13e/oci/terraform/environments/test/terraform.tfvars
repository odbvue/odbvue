# Test Environment Configuration

# --- Non-sensitive defaults (edit these) ---
region                  = "eu-stockholm-1"
compartment_ocid        = "ocid1.tenancy.oc1..aaaaaaaaqq6caf32ecspmq3gunerzx6f3hrldykufeggxnark467nidnfnhq"
db_name                 = "OdbVue"
display_name            = "OdbVue"
cpu_core_count          = 0
data_storage_tbs        = 1
license_model           = "LICENSE_INCLUDED"  # Required for free tier
db_version              = "19c"
is_free_tier            = true
is_auto_scaling_enabled = false  # Must be false for free tier

# Wallet configuration
generate_wallet = true

# Security - IP whitelist (null allows all IPs)
whitelisted_ips = null  # For test, allow all IPs

# Tags
common_tags = {
  "Project"     = "OdbVue"
  "Environment" = "test"
  "CreatedBy"   = "terraform"
  "Owner"       = "development-team"
}

# --- Sensitive variables (set via terraform.tfvars.local or environment variables) ---
# admin_password    = "YourSecurePassword123!"
# wallet_password   = "YourWalletPassword123!"