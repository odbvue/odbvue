################################################
# IAM: Resource principals access to Object    #
# Storage for ALL resources in the app         #
# compartment.                                 #
#                                              #
# - Dynamic groups (tenancy-level):            #
#   * Autonomous Databases in the compartment  #
# - Policies (tenancy-level, scoped to the     #
#   application compartment by name):          #
#   * manage buckets and objects for both DGs  #
################################################

# Dynamic group for Autonomous Databases in the application compartment (tenancy-level IAM)
resource "oci_identity_dynamic_group" "dg_adb" {
  compartment_id = local.tenancy_ocid
  name           = "odbvue-dg-adb"
  description    = "Autonomous Databases in ${local.compartment_name}"

  # All ADBs in the target compartment
  matching_rule = "ALL { resource.compartment.id = '${local.compartment_ocid}', resource.type = 'autonomousdatabase' }"
}

# Tenancy-level policy granting access scoped to the application compartment
resource "oci_identity_policy" "p_objectstore_compartment_manage" {
  compartment_id = local.tenancy_ocid
  name           = "odbvue-policy-objectstore-compartment-manage"
  description    = "Allow ADBs in ${local.compartment_name} to manage buckets and objects in ${local.compartment_name}"

  statements = [
    "Allow dynamic-group ${oci_identity_dynamic_group.dg_adb.name} to manage objects in compartment ${local.compartment_name}",
    "Allow dynamic-group ${oci_identity_dynamic_group.dg_adb.name} to manage buckets in compartment ${local.compartment_name}"
  ]
}

output "dynamic_group_adb_name" {
  value       = oci_identity_dynamic_group.dg_adb.name
  description = "Dynamic group name for Autonomous Databases"
}

output "policy_objectstore_compartment_manage_name" {
  value       = oci_identity_policy.p_objectstore_compartment_manage.name
  description = "Policy name granting manage on buckets/objects in the compartment for ADBs"
}

