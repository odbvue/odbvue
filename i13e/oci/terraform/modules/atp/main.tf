# ATP (Autonomous Transaction Processing) Module

resource "oci_database_autonomous_database" "atp" {
  compartment_id           = var.compartment_ocid
  cpu_core_count          = var.cpu_core_count
  data_storage_size_in_tbs = var.data_storage_tbs
  db_name                 = var.db_name
  display_name            = var.display_name
  
  # Database configuration
  db_version              = var.db_version
  license_model           = var.license_model
  is_free_tier           = var.is_free_tier
  is_auto_scaling_enabled = var.is_auto_scaling_enabled
  
  # Security
  admin_password         = var.admin_password
  are_primary_whitelisted_ips_used = var.whitelisted_ips != null ? true : false
  whitelisted_ips        = var.whitelisted_ips
  
  # Optional configurations
  is_data_guard_enabled  = var.is_data_guard_enabled
  autonomous_maintenance_schedule_type = var.maintenance_schedule_type
  
  # Tags
  freeform_tags = merge(var.common_tags, {
    "Environment" = var.environment
    "Module"      = "atp"
    "ManagedBy"   = "terraform"
  })
  
  lifecycle {
    prevent_destroy = false
    ignore_changes = [
      # Ignore password changes after initial creation
      admin_password,
    ]
  }
}

# Generate a wallet for database connection
resource "oci_database_autonomous_database_wallet" "atp_wallet" {
  count = var.generate_wallet ? 1 : 0
  
  autonomous_database_id = oci_database_autonomous_database.atp.id
  password              = var.wallet_password
  base64_encode_content = true
  
  lifecycle {
    ignore_changes = [
      password,
    ]
  }
}