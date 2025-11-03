# Data source to find compartment by display name
data "oci_identity_compartments" "existing" {
  compartment_id = local.tenancy_ocid
  filter {
    name   = "name"
    values = [local.compartment_name]
  }
  # Only get active compartments
  filter {
    name   = "lifecycle_state"
    values = ["ACTIVE"]
  }
}

# Create compartment only if it doesn't exist
resource "oci_identity_compartment" "main" {
  # Count = 0 if found, 1 if not found
  count = length(data.oci_identity_compartments.existing.compartments) > 0 ? 0 : 1

  compartment_id = local.tenancy_ocid
  name           = local.compartment_name
  description    = "odbvue production compartment"
  enable_delete  = true
}

# Output the compartment OCID (either existing or newly created)
locals {
  # Whether a compartment with the desired name already exists (plan-time known)
  compartment_found = length(data.oci_identity_compartments.existing.compartments) > 0

  compartment_ocid = length(data.oci_identity_compartments.existing.compartments) > 0 ? data.oci_identity_compartments.existing.compartments[0].id : oci_identity_compartment.main[0].id
}
