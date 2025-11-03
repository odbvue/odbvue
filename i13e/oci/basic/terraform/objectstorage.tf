# Namespace
data "oci_objectstorage_namespace" "ns" {
  compartment_id = local.tenancy_ocid
}

resource "oci_objectstorage_bucket" "obj" {
  namespace      = data.oci_objectstorage_namespace.ns.namespace
  compartment_id = local.compartment_ocid
  name           = "odbvue-obj"
  access_type    = "NoPublicAccess"
}
