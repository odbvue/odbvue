# VCN
resource "oci_core_vcn" "vcn" {
  compartment_id = local.compartment_ocid
  display_name   = local.vcn_name
  cidr_block     = local.vcn_cidr
  dns_label      = "odbvuevcn"
}

# Internet Gateway
resource "oci_core_internet_gateway" "igw" {
  compartment_id = local.compartment_ocid
  vcn_id         = oci_core_vcn.vcn.id
  display_name   = local.igw_name
  enabled        = true
}

# DHCP Options with DNS
resource "oci_core_dhcp_options" "dns_options" {
  compartment_id = local.compartment_ocid
  vcn_id         = oci_core_vcn.vcn.id
  display_name   = "DNS-Options"

  options {
    type        = "DomainNameServer"
    server_type = "VcnLocalPlusInternet"
  }

  options {
    type                = "SearchDomain"
    search_domain_names = ["vcn.oraclevcn.com"]
  }
}

# Route Table (default route to IGW)
resource "oci_core_route_table" "rt" {
  compartment_id = local.compartment_ocid
  vcn_id         = oci_core_vcn.vcn.id
  display_name   = local.rt_name

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.igw.id
  }
}

# Subnet (public)
resource "oci_core_subnet" "public_web" {
  compartment_id             = local.compartment_ocid
  vcn_id                     = oci_core_vcn.vcn.id
  display_name               = local.subnet_name
  cidr_block                 = local.subnet_cidr
  dns_label                  = "web"
  route_table_id             = oci_core_route_table.rt.id
  prohibit_public_ip_on_vnic = false
  dhcp_options_id            = oci_core_dhcp_options.dns_options.id
}

# NSG
resource "oci_core_network_security_group" "nsg_web" {
  compartment_id = local.compartment_ocid
  vcn_id         = oci_core_vcn.vcn.id
  display_name   = local.nsg_web_name
}

# NSG Rules  -  inbound 80/443/22
resource "oci_core_network_security_group_security_rule" "nsg_web_in_http" {
  network_security_group_id = oci_core_network_security_group.nsg_web.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = "0.0.0.0/0"
  description               = "Allow HTTP"
  tcp_options {
    destination_port_range {
      min = 80
      max = 80
    }
  }
}

resource "oci_core_network_security_group_security_rule" "nsg_web_in_https" {
  network_security_group_id = oci_core_network_security_group.nsg_web.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = "0.0.0.0/0"
  description               = "Allow HTTPS"
  tcp_options {
    destination_port_range {
      min = 443
      max = 443
    }
  }
}

resource "oci_core_network_security_group_security_rule" "nsg_web_in_ssh" {
  network_security_group_id = oci_core_network_security_group.nsg_web.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = "0.0.0.0/0"
  description               = "Allow SSH (per request)"
  tcp_options {
    destination_port_range {
      min = 22
      max = 22
    }
  }
}

# NSG egress  -  all
resource "oci_core_network_security_group_security_rule" "nsg_web_egress_all" {
  network_security_group_id = oci_core_network_security_group.nsg_web.id
  direction                 = "EGRESS"
  protocol                  = "all"
  destination               = "0.0.0.0/0"
  description               = "Allow all egress"
}
