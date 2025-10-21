# Test Environment Outputs

output "atp_id" {
  description = "OCID of the ATP database"
  value       = module.atp_test.atp_id
}

output "atp_display_name" {
  description = "Display name of the ATP database"
  value       = module.atp_test.atp_display_name
}

output "atp_db_name" {
  description = "Database name"
  value       = module.atp_test.atp_db_name
}

output "atp_state" {
  description = "Current state of the ATP database"
  value       = module.atp_test.atp_state
}

output "atp_connection_urls" {
  description = "Connection URLs for APEX and SQL Developer Web"
  value       = module.atp_test.atp_connection_urls
}

output "atp_service_console_url" {
  description = "Service Console URL"
  value       = module.atp_test.atp_service_console_url
}

output "wallet_content" {
  description = "Database wallet content (base64 encoded)"
  value       = module.atp_test.wallet_content
  sensitive   = true
}

output "atp_connection_strings" {
  description = "Database connection strings"
  value       = module.atp_test.atp_connection_strings
  sensitive   = true
}