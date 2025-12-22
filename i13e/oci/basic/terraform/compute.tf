# Get available domains in the current region
data "oci_identity_availability_domains" "available" {
  compartment_id = local.tenancy_ocid
}

# Compute constants
locals {
  instance_shape   = "VM.Standard.E2.1.Micro"
  instance_display = "odbvue-web"
}

# Find Oracle Linux 9 Minimal image (platform images are in tenancy root)
data "oci_core_images" "ol9_minimal" {
  compartment_id = local.tenancy_ocid

  filter {
    name   = "display_name"
    values = ["Oracle-Linux-9.6-Minimal-2025.06.30-0"]
  }

  state = "AVAILABLE"
}

resource "oci_core_instance" "web" {
  compartment_id      = local.compartment_ocid
  availability_domain = data.oci_identity_availability_domains.available.availability_domains[0].name
  display_name        = local.instance_display
  shape               = local.instance_shape

  source_details {
    source_type = "image"
    source_id   = data.oci_core_images.ol9_minimal.images[0].id
    # Minimum boot volume size is 50GB; set explicitly to avoid provider attempts
    # to retain a smaller inherited size (e.g., 47GB) on shape changes.
    boot_volume_size_in_gbs = 50
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.public_web.id
    nsg_ids          = [oci_core_network_security_group.nsg_web.id]
    assign_public_ip = false
    display_name     = "primary"
  }

  metadata = {
    ssh_authorized_keys = file(var.ssh_public_key_path)
  }
}


# Get the instance primary VNIC
data "oci_core_vnic_attachments" "web" {
  compartment_id = local.compartment_ocid
  instance_id    = oci_core_instance.web.id
}

data "oci_core_vnic" "web_primary" {
  vnic_id = data.oci_core_vnic_attachments.web.vnic_attachments[0].vnic_id
}

# Resolve the private IP OCID for the VNIC's primary private IP address
data "oci_core_private_ips" "web_primary" {
  vnic_id = data.oci_core_vnic.web_primary.id
}
