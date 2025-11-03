# Data source to find existing public IP by display name
# Only query when the compartment already exists; otherwise there can't be an existing IP.
data "oci_core_public_ips" "existing" {
  count          = local.compartment_found ? 1 : 0
  compartment_id = data.oci_identity_compartments.existing.compartments[0].id
  scope          = "COMPARTMENT"
  filter {
    name   = "display_name"
    values = [local.public_ip_display_name]
  }
}

# Create public IP only if it doesn't exist
resource "oci_core_public_ip" "web" {
  # Create if no existing IP in an existing compartment; also create if the compartment doesn't exist yet
  count = local.compartment_found ? (length(data.oci_core_public_ips.existing[0].public_ips) > 0 ? 0 : 1) : 1

  compartment_id = local.compartment_ocid
  lifetime       = "RESERVED"
  display_name   = local.public_ip_display_name
  # When we create the reserved IP, attach it to the instance's primary private IP
  private_ip_id  = data.oci_core_private_ips.web_primary.private_ips[0].id

  lifecycle { prevent_destroy = false }
}

# Output the public IP OCID (either existing or newly created)
locals {
  public_ip_ocid = local.compartment_found && length(data.oci_core_public_ips.existing[0].public_ips) > 0 ? data.oci_core_public_ips.existing[0].public_ips[0].id : oci_core_public_ip.web[0].id
}
