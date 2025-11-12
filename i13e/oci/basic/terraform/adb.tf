resource "oci_database_autonomous_database" "adb" {
  compartment_id               = local.compartment_ocid
  db_name                      = var.adb_db_name
  display_name                 = "odbvue-adb"
  db_workload                  = var.adb_workload
  is_free_tier                 = true     # Always Free ADB
  admin_password               = var.adb_admin_password
  is_mtls_connection_required  = true
}

# Download ADB wallet
resource "oci_database_autonomous_database_wallet" "adb_wallet" {
  autonomous_database_id = oci_database_autonomous_database.adb.id
  password               = var.adb_wallet_password
  base64_encode_content  = true
}

# Save wallet to local file (using local_sensitive_file to properly handle binary data)
resource "local_sensitive_file" "adb_wallet_file" {
  content_base64 = oci_database_autonomous_database_wallet.adb_wallet.content
  filename       = "${path.module}/../.wallets/Wallet_${var.adb_db_name}.zip"

  depends_on = [oci_database_autonomous_database_wallet.adb_wallet]
}
