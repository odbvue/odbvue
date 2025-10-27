# Get available domains in the current region
data "oci_identity_availability_domains" "available" {
  compartment_id = local.tenancy_ocid
}

# Compute constants
locals {
  instance_shape   = "VM.Standard.E5.Flex"
  instance_display = "odbvue-web"
}

# Find Oracle Linux 9 image
data "oci_core_images" "ol9" {
  compartment_id             = local.compartment_ocid
  operating_system           = "Oracle Linux"
  operating_system_version   = "9"
  shape                      = local.instance_shape
  sort_by                    = "TIMECREATED"
  sort_order                 = "DESC"
  state                      = "AVAILABLE"
}

resource "oci_core_instance" "web" {
  compartment_id      = local.compartment_ocid
  availability_domain = data.oci_identity_availability_domains.available.availability_domains[0].name
  display_name        = local.instance_display
  shape               = local.instance_shape

  shape_config {
    ocpus         = 1
    memory_in_gbs = 4
  }

  source_details {
    source_type = "image"
    source_id   = data.oci_core_images.ol9.images[0].id
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.public_web.id
    nsg_ids          = [oci_core_network_security_group.nsg_web.id]
    assign_public_ip = false
    display_name     = "primary"
  }

  metadata = {
    ssh_authorized_keys = file(var.ssh_public_key_path)
    user_data           = base64encode(<<-EOT
      #cloud-config
      runcmd:
      - yum install -y nginx
      - systemctl enable --now nginx
      - bash -c 'echo "<!doctype html><title>OdbVue</title><h1>It works!</h1>" > /usr/share/nginx/html/index.html'
      - sudo systemctl start firewalld || true
      - sudo firewall-cmd --permanent --add-service=http
      - sudo firewall-cmd --permanent --add-service=https
      - sudo firewall-cmd --reload
      - sudo firewall-cmd --list-services
      EOT
    )
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
