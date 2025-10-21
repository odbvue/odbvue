# Test Environment - ATP Configuration

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 5.0"
    }
  }
  
  backend "local" {
    path = "./terraform.tfstate"
  }
}

# Configure the Oracle Cloud Infrastructure Provider
provider "oci" {
  region = var.region
  # OCI profile is configured via OCI_CLI_PROFILE environment variable
}

# ATP Module for Test Environment
module "atp_test" {
  source = "../../modules/atp"
  
  # Required variables
  compartment_ocid = var.compartment_ocid
  db_name         = var.db_name
  display_name    = "${var.display_name}-test"
  admin_password  = var.admin_password
  
  # Database configuration
  cpu_core_count          = var.cpu_core_count
  data_storage_tbs        = var.data_storage_tbs
  db_version              = var.db_version
  license_model           = var.license_model
  is_free_tier           = var.is_free_tier
  is_auto_scaling_enabled = var.is_auto_scaling_enabled
  
  # Security
  whitelisted_ips = var.whitelisted_ips
  
  # Wallet
  generate_wallet = var.generate_wallet
  wallet_password = var.wallet_password
  
  # Environment and tags
  environment = "test"
  common_tags = var.common_tags
}