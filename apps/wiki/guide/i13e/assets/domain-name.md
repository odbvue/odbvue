# Domain Name

A domain name is the human-readable address of your website (e.g., `example.com`). It's essential for giving your site an identity that people can remember and access.

## Key Concepts

**Domain Registrar**: A company authorized to sell and manage domain names. Examples include GoDaddy, Namecheap, and Google Domains. Choose one that's accredited by ICANN (Internet Corporation for Assigned Names and Numbers).

**DNS (Domain Name System)**: The system that translates domain names into IP addresses, directing traffic to your actual server.

**Top-Level Domain (TLD)**: The extension at the end of your domain (e.g., `.com`, `.org`, `.io`). Different TLDs suit different purposes.

## Getting a Domain

### Step 1: Choose a Registrar
Pick a reputable registrar based on pricing, support quality, and user interface. Most have similar pricing ($10-15/year).

### Step 2: Search for Availability
Visit your registrar's website and search for your desired domain name. If unavailable, try:
- A different TLD (`.io`, `.net`, `.dev`)
- Slightly different spelling or wording
- Adding relevant words (e.g., `myapp-io.com`)

> [!TIP}
> - **Keep it simple**: Easy to spell, pronounce, and remember.
> - **Length matters**: Shorter is generally better, but clarity beats brevity.
> - **Avoid hyphens and numbers**: These can confuse users.
> - **Plan ahead**: Register early if possible—popular names sell quickly.

### Step 3: Register
Purchase the domain for at least one year. Multi-year purchases often offer discounts. Then configure DNS records to point to your server (your hosting provider will guide this).

### Step 4: Set Renewal Reminders

**Important**: Domains expire if not renewed. Set a calendar reminder 30-60 days before your renewal date to ensure you don't lose access to your domain. Most registrars offer auto-renewal options—you can enable this to avoid forgetting, but always monitor it to catch billing issues.

Note: Even if you've paid for multiple years, some registrars require annual technical renewals or confirmations. Check your registrar's requirements to stay compliant.

## Understanding DNS Records

DNS records control where your domain points and how it behaves. Common types include:

- **A Record**: Points your domain to an IPv4 address (your server's IP). This is what makes your domain accessible. Each subdomain also needs its own A record (e.g., separate records for `example.com` and `api.example.com`).
- **AAAA Record**: The IPv6 equivalent of an A record.
- **CNAME Record**: Aliases one domain to another (useful for subdomains like `www` or `api`, but cannot be used on the root domain itself).
- **TXT Record**: Text records used for verification (e.g., confirming email ownership) and security (SPF, DKIM for email).
- **MX Record**: Directs email to your mail server.
- **NS Record**: Points to your DNS provider's nameservers.

**Critical**: DNS changes propagate globally over time (typically 24-48 hours, sometimes longer). Plan carefully when making changes—don't update records on Friday afternoon if something breaks immediately! Test thoroughly and allow propagation time before relying on new configurations.




