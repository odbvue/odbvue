# SSL Certificates

## Key Concepts

### What Are SSL Certificates?

SSL (Secure Sockets Layer) certificates are digital credentials that encrypt communication between your website visitor's browser and your web server. They protect sensitive information like login credentials, payment data, and personal information from being intercepted by attackers.

When you visit a website with a valid SSL certificate, you'll see a padlock icon in your browser's address bar and the URL starts with "https://" (the "s" stands for secure).

### Types of SSL Certificates

**Domain Validation (DV) Certificates**
- The most basic type of SSL certificate
- Requires only verification that you own the domain
- Fastest and cheapest option (or free with Let's Encrypt)
- Best for: personal blogs, small projects, educational sites

**Organization Validation (OV) Certificates**
- Includes verification that your organization is legitimate and registered
- Shows company information in the certificate details
- More trustworthy appearance to visitors
- Best for: small to medium businesses, professional services

**Extended Validation (EV) Certificates**
- Highest level of verification - requires thorough business documentation review
- Shows your organization's name prominently in the browser
- Most expensive option
- Best for: e-commerce sites, financial institutions, high-value transactions

**Wildcard Certificates**
- Covers your domain and all its subdomains (e.g., *.yourdomain.com)
- Useful if you're hosting multiple services under different subdomains
- Available from commercial providers and Let's Encrypt (requires DNS validation)

### Commercial vs. Free Certificates

| Aspect | Commercial SSL | Let's Encrypt (Free) |
|--------|-----------------|-------------------|
| **Cost** | $50-300+ annually | Free |
| **Validity Period** | 1-3 years | 90 days |
| **Warranty** | Usually included | None |
| **Support** | Dedicated support teams | Community-based support |
| **Certificate Types** | DV, OV, EV, Wildcard | DV, Wildcard |
| **Verification** | Varies by type | Automatic domain/DNS validation |
| **Best For** | Business websites, e-commerce | Personal projects, education, testing |

## Commercial SSL Certificates

### Main Issuers

Popular Certificate Authorities include:
- **DigiCert** - Industry-leading, premium certificates
- **GlobalSign** - Well-established, comprehensive support
- **Sectigo** - Affordable options, good for SMBs
- **Comodo/Sectigo** - Budget-friendly to premium tier
- **GoDaddy** - User-friendly interface, widely available

### Step-by-Step Process

#### Step 1: Generate a Certificate Signing Request (CSR)

Connect to your server via SSH and run this command:

```bash
openssl req -new -newkey rsa:2048 -nodes -keyout yourdomain.key -out yourdomain.csr
```

This creates two files:
- `yourdomain.key` - Your private key (keep this secret!)
- `yourdomain.csr` - Your certificate signing request (you'll submit this)

#### Step 2: Fill in Certificate Information

When prompted, enter your details. Use only alphanumeric characters:

| Field | What to Enter |
|-------|---------------|
| **Country Name** | Two-letter country code (e.g., US, GB) |
| **State/Province** | Full name of your state or region |
| **Locality** | City or town name |
| **Organization Name** | Legal company name (use "NA" for DV certificates) |
| **Organization Unit** | Department name (e.g., IT, Web Administration) or "NA" |
| **Common Name** | Your domain name (e.g., example.com). For wildcard: `*.example.com` |
| **Email Address** | Valid email address for certificate contact |
| **Challenge Password** | Leave blank (optional and deprecated) |
| **Company Name** | Leave blank (optional) |

#### Step 3: Open Your CSR File

```bash
cat yourdomain.csr
```

Copy the entire content including the `-----BEGIN CERTIFICATE REQUEST-----` and `-----END CERTIFICATE REQUEST-----` lines.

#### Step 4: Order from Certificate Authority

1. Go to your chosen CA's website (DigiCert, GlobalSign, etc.)
2. Select the certificate type you want
3. Paste your CSR into their form
4. Complete the ordering process
5. Verify your domain ownership (the CA will email you verification links)
   - **Important:** Make sure you have an email account set up at `admin@yourdomain.com` or the domain's MX records configured (this is why email setup is important)

> [!TIP] 
> If you don't have a mail server configured yet, you can use [ImprovMX](https://app.improvmx.com/) for free email forwarding. Simply add their MX records to your DNS configuration, and you'll be able to receive emails at any address on your domain. This is perfect for domain verification emails from certificate authorities.

#### Step 5: Receive and Install Your Certificate

Once the CA approves your certificate:

1. Download the certificate files from the CA
2. Copy them to your server
3. Configure your Nginx web server to use the certificate
4. Test that HTTPS is working

## Let's Encrypt - Free SSL Certificates

### Why Use Let's Encrypt?

- **Completely free** - No annual fees
- **Automated** - Can automate renewal process
- **Fast** - Instant validation and certificate issuance
- **Perfect for:** Learning, personal projects, small businesses, development

### Prerequisites

You'll need:
- SSH access to your server
- `certbot` installed on your server
- DNS access to add TXT records (for wildcard certificates)
- Email account configured on your domain (for domain validation)

### Step-by-Step Process

#### Step 1: Install Certbot

On your server, install the Certbot tool for Nginx:

```bash
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx
```

#### Step 2: Generate Your Certificate

For a standard domain certificate with Nginx:

```bash
sudo certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com
```

For a wildcard certificate (requires manual DNS validation):

```bash
sudo certbot certonly --manual --preferred-challenges dns -d "*.yourdomain.com" -d "yourdomain.com" --force-renewal
```

#### Step 3: Respond to DNS Challenge (Wildcard Only)

If you're creating a wildcard certificate, Certbot will display a TXT record you need to add:

```
Please deploy a DNS TXT record under the name
_acme-challenge.yourdomain.com with the following value:

abcd1234efgh5678ijkl9012mnop3456
```

1. Go to your DNS provider's website
2. Add a TXT record with the name and value shown above
3. Wait a few seconds for DNS to propagate
4. Return to your terminal and press Enter to continue

**Tip:** You can verify the DNS record was updated by visiting:
```
https://toolbox.googleapps.com/apps/dig/#TXT/_acme-challenge.yourdomain.com
```

#### Step 4: Complete Certificate Setup

Once validation completes, reload your web server:

```bash
sudo systemctl reload nginx
```

#### Step 5: Set Up Automatic Renewal

 **Important:** Let's Encrypt certificates expire every 90 days. Set up automatic renewal:

```bash
sudo certbot renew --dry-run
```

This tests the renewal process. Then enable automatic renewal:

```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### Checking Certificate Status

To see your certificates:

```bash
sudo certbot certificates
```

## Decision Guide

**Use Commercial SSL if:**
- Your site processes payments or sensitive business data
- You need extended validation for trust/branding
- You prefer 1-3 year validity periods
- You want dedicated support

**Use Let's Encrypt if:**
- You're learning or experimenting
- You want zero cost
- You can set up automation on your server
- You need to cover multiple subdomains with a wildcard
