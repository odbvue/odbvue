# ATP Module Outputs

output "atp_id" {
  description = "OCID of the Autonomous Database"
  value       = oci_database_autonomous_database.atp.id
}

output "atp_display_name" {
  description = "Display name of the Autonomous Database"
  value       = oci_database_autonomous_database.atp.display_name
}

output "atp_db_name" {
  description = "Database name of the Autonomous Database"
  value       = oci_database_autonomous_database.atp.db_name
}

output "atp_state" {
  description = "The current state of the Autonomous Database"
  value       = oci_database_autonomous_database.atp.state
}

output "atp_connection_strings" {
  description = "The connection string used to connect to the Autonomous Database"
  value       = oci_database_autonomous_database.atp.connection_strings
  sensitive   = true
}

output "atp_connection_urls" {
  description = "The URLs for accessing Oracle Application Express (APEX) and SQL Developer Web"
  value       = oci_database_autonomous_database.atp.connection_urls
}

output "atp_service_console_url" {
  description = "The URL of the Service Console for the Autonomous Database"
  value       = oci_database_autonomous_database.atp.service_console_url
}

output "wallet_content" {
  description = "Content of the wallet file (base64 encoded)"
  value       = var.generate_wallet ? oci_database_autonomous_database_wallet.atp_wallet[0].content : null
  sensitive   = true
}