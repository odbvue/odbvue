variable "oci_profile" {
  description = "OCI profile name (DEFAULT, ODBVUE, etc.)"
  type        = string
  default     = "DEFAULT"
}

variable "region" {
  description = "OCI region (e.g., eu-frankfurt-1)"
  type        = string
}

variable "tenancy_ocid" {
  description = "Your OCI Tenancy OCID"
  type        = string
}

variable "ssh_public_key_path" {
  description = "Path to .pub key"
  type        = string
  default     = "../.ssh/odbvue.pub"
}

# ADB
variable "adb_db_name" {
  type    = string
  default = "odbvueadb"
}

variable "adb_workload" {
  type    = string
  default = "OLTP"   # OLTP | DW | AJD | APEX
}

variable "adb_cpu_count" {
  type    = number
  default = 1
}

variable "adb_storage_tb" {
  type    = number
  default = 1
}

variable "adb_admin_password" {
  type      = string
  sensitive = true   # must meet OCI password policy
}

variable "adb_wallet_password" {
  description = "Password for the ADB wallet"
  type        = string
  sensitive   = true
}

# Email Delivery
variable "email_sender" {
  type    = string
  default = ""  # optional; set to enable sender creation
}

locals {
  # Compartment and Public IP
  compartment_name            = "odbvue-test"
  public_ip_display_name      = "odbvue-web-ip"
  tenancy_ocid                = var.tenancy_ocid
  region                      = var.region
  
  # Network CIDRs and names
  vcn_cidr       = "10.0.0.0/24"
  subnet_cidr    = "10.0.0.0/24"
  vcn_name       = "odbvue-vcn"
  subnet_name    = "odbvue-public-web"
  igw_name       = "odbvue-igw"
  nsg_web_name   = "odbvue-nsg-web"
  rt_name        = "odbvue-rt"
  
  smtp_endpoint  = "email-smtp.${local.region}.oci.oraclecloud.com:587"
}
