output "instance_private_ip" {
  value = data.oci_core_vnic.web_primary.private_ip_address
}

output "instance_public_ip" {
  description = "Reserved public IP attached to the instance"
  value       = local.compartment_found && length(data.oci_core_public_ips.existing[0].public_ips) > 0 ? data.oci_core_public_ips.existing[0].public_ips[0].ip_address : oci_core_public_ip.web[0].ip_address
}

output "adb_admin_password_reminder" {
  description = "Reminder: ADB admin password was set via terraform.tfvars"
  value       = "Use 'admin' as username. Password is in your terraform.tfvars (KEEP SECURE!)"
  sensitive   = false
}

output "adb_connection_strings_note" {
  value = "See OCI Console -> Autonomous Database -> 'odbvue-adb' -> DB Connection for wallet/strings."
}

output "object_storage_bucket_url_hint" {
  value = "Use the namespace (${data.oci_objectstorage_namespace.ns.namespace}) and bucket 'odbvue-obj'. Objects are public (read)."
}
