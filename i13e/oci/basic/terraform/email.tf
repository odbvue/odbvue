# Optional: Approved Sender (if you set var.email_sender)
resource "oci_email_sender" "sender" {
  count          = length(var.email_sender) > 0 ? 1 : 0
  compartment_id = local.compartment_ocid
  email_address  = var.email_sender
  lifecycle { create_before_destroy = true }
}

output "email_smtp_endpoint" {
  value = local.smtp_endpoint
}
