# ========================================================================
# Email Domain (for DKIM/SPF configuration)
# ========================================================================
resource "oci_email_email_domain" "domain" {
  count          = length(var.email_domain) > 0 ? 1 : 0
  compartment_id = local.compartment_ocid
  name           = var.email_domain
  description    = "Email domain for ODBVUE application emails"
  
  lifecycle { create_before_destroy = true }
}

# ========================================================================
# DKIM Configuration
# ========================================================================
resource "oci_email_dkim" "dkim" {
  count           = length(var.email_domain) > 0 ? 1 : 0
  email_domain_id = oci_email_email_domain.domain[0].id
  
  name        = "odbvue-dkim-${local.region}"
  description = "DKIM key for ${var.email_domain}"
  
  lifecycle { create_before_destroy = true }
}

# ========================================================================
# Approved Sender
# Note: Sender will be automatically linked to domain if email matches domain
# ========================================================================
resource "oci_email_sender" "sender" {
  count          = length(var.email_sender) > 0 ? 1 : 0
  compartment_id = local.compartment_ocid
  email_address  = var.email_sender
  
  lifecycle { create_before_destroy = true }
}

# ========================================================================
# Outputs
# ========================================================================
output "email_smtp_endpoint" {
  value = local.smtp_endpoint
}

output "email_domain_verification_status" {
  value       = length(var.email_domain) > 0 ? oci_email_email_domain.domain[0].state : "No email domain configured"
  description = "Email domain verification status (ACTIVE after DNS records are added)"
}

output "dns_records_required" {
  value = length(var.email_domain) > 0 ? {
    domain = var.email_domain
    
    dkim_cname_record = {
      name  = oci_email_dkim.dkim[0].dns_subdomain_name
      type  = "CNAME"
      value = oci_email_dkim.dkim[0].cname_record_value
    }
    
    spf_txt_record = {
      name  = "@"
      type  = "TXT"
      value = "v=spf1 include:${local.region}.rp.oracleemaildelivery.com ~all"
      note  = "If you have existing SPF record, add 'include:${local.region}.rp.oracleemaildelivery.com' to it"
    }
    
    instructions = <<-EOT
      
      ╔════════════════════════════════════════════════════════════════════════╗
      ║  DNS RECORDS REQUIRED FOR EMAIL DOMAIN: ${var.email_domain}
      ╚════════════════════════════════════════════════════════════════════════╝
      
      Add the following records to your DNS provider:
      
      1. DKIM CNAME Record (for email authentication):
         ────────────────────────────────────────────────────────────────────
         Name:  ${oci_email_dkim.dkim[0].dns_subdomain_name}
         Type:  CNAME
         Value: ${oci_email_dkim.dkim[0].cname_record_value}
      
      2. SPF TXT Record (for sender policy framework):
         ────────────────────────────────────────────────────────────────────
         Name:  @ (or your domain root)
         Type:  TXT
         Value: v=spf1 include:${local.region}.rp.oracleemaildelivery.com ~all
         
         ⚠️  If you already have an SPF record, ADD this to it:
             include:${local.region}.rp.oracleemaildelivery.com
             (Don't create multiple SPF records - merge into existing one)
      
      ────────────────────────────────────────────────────────────────────────
      After adding these DNS records:
      - Wait 10-30 minutes for DNS propagation
      - The domain state will change from CREATING to ACTIVE
      - DKIM state will change to ACTIVE
      - SPF will be detected automatically (is_spf = true)
      - Run 'terraform refresh' to check status
      ────────────────────────────────────────────────────────────────────────
    EOT
  } : {
    domain             = ""
    dkim_cname_record  = { name = "", type = "", value = "" }
    spf_txt_record     = { name = "", type = "", value = "", note = "" }
    instructions       = "Set var.email_domain to enable email domain configuration with DKIM/SPF"
  }
  
  description = "DNS records that must be manually added to your DNS provider for email authentication"
}
