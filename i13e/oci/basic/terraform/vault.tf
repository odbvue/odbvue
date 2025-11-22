# OCI Vault & KMS Key for storing DBMS_CRYPTO master key
# This vault securely stores the 32-byte AES key used by PL/SQL encryption

data "oci_identity_compartments" "compartment" {
  compartment_id = var.tenancy_ocid
  filter {
    name   = "name"
    values = [local.compartment_name]
  }
}

locals {
  compartment_id = try(data.oci_identity_compartments.compartment.compartments[0].id, null)
}

# Create KMS Vault (if not already exists)
resource "oci_kms_vault" "master_vault" {
  compartment_id = local.compartment_id
  display_name   = "odbvue-master-vault"
  vault_type     = "DEFAULT"

  lifecycle {
    prevent_destroy = true
  }
}

# Wait for vault DNS endpoint to propagate
resource "time_sleep" "wait_for_vault_dns" {
  depends_on      = [oci_kms_vault.master_vault]
  create_duration = "45s"
}

# Create symmetric KMS master key (AES-256) for encrypting vault secrets
resource "oci_kms_key" "master_key" {
  compartment_id      = local.compartment_id
  display_name        = "odbvue-master-key"
  management_endpoint = oci_kms_vault.master_vault.management_endpoint

  key_shape {
    algorithm = "AES"
    length    = 32  # 32 bytes = 256 bits for AES-256
  }

  depends_on = [time_sleep.wait_for_vault_dns]

  lifecycle {
    prevent_destroy = true
  }
}

# Generate random 32-byte master key for DBMS_CRYPTO (AES-256)
resource "random_password" "plsql_master_key" {
  length      = 32
  min_lower   = 1
  min_upper   = 1
  min_numeric = 1
  min_special = 1

  lifecycle {
    ignore_changes = all  # Don't regenerate on every apply
  }
}

# Store the PL/SQL master key in OCI Vault Secret (encrypted with KMS key)
resource "oci_vault_secret" "plsql_master_secret" {
  compartment_id = local.compartment_id
  secret_name    = "odbvue-plsql-master-key"
  description    = "32-byte master key for DBMS_CRYPTO AES-256 encryption"

  vault_id = oci_kms_vault.master_vault.id
  key_id   = oci_kms_key.master_key.id

  secret_content {
    content_type = "BASE64"
    # Encode the random password as base64 for storage in vault
    content = base64encode(random_password.plsql_master_key.result)
    name    = "plsql-master-key-v1"
    stage   = "CURRENT"
  }

  lifecycle {
    prevent_destroy = true
  }
}
