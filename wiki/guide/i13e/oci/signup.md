# Sign up to Oracle Cloud

## Account Registration

### Step 1: Start Registration

Navigate to [cloud.oracle.com](https://cloud.oracle.com) and click **Sign Up for Free Tier** or **Start for free**.

### Step 2: Enter Account Details

Fill in the required information:
- Cloud account name (unique identifier)
- Country/Territory
- Email address

Verify your email by clicking the link sent to your inbox.

### Step 3: Configure Account Settings

Complete your account setup:
- Create a strong password
- Confirm your cloud account name
- Select your home region (e.g., US East - Ashburn, Germany - Frankfurt)

> [!TIP]
> Choose a region closest to your location for optimal performance. This cannot be changed later.

### Step 4: Enter Personal Information

Provide your address and contact details.

### Step 5: Payment Verification

Oracle Cloud requires credit or debit card information for identity verification purposes. This is a standard security measure to prevent fraud and abuse.

**Important points about payment verification:**
- Your card will NOT be charged during the Free Tier trial period
- You receive **$300 USD in free credits** valid for 30 days
- You also get **Always Free services** that never expire
- You will NOT be charged after the trial unless you explicitly upgrade to a Pay As You Go account
- Accepted payment methods include major credit cards and debit cards

> [!NOTE]
> Oracle uses payment information only for verification. Your account will remain free unless you choose to upgrade to a paid account. After the 30-day trial, you can continue using Always Free services indefinitely without any charges.

### Step 6: Phone Verification

Enter your mobile number with the correct country code and verify via SMS code.

### Step 7: Accept Terms

Review and accept the Oracle Cloud Free Tier terms and conditions, then click **Start My Free Trial**.

### Step 8: Account Activation

Your account is created immediately. You'll receive:
- Welcome email with sign-in credentials
- Confirmation email when all services are provisioned (typically within minutes)
- $300 USD in free cloud credits (valid for 30 days)
- Access to Always Free services (unlimited time)

> [!TIP]
> After 30 days, you can continue using Always Free services at no cost, or upgrade to a Pay As You Go account to access additional services. You will only be charged if you explicitly choose to upgrade.

## Security Setup

### Enable Two-Factor Authentication (2FA)

For enhanced security, enable 2FA immediately after account creation:

1. Sign in to your Oracle Cloud account
2. Navigate to **Profile** > **My Profile** > **Security**
3. Enable **Multi-Factor Authentication (MFA)**
4. Use the **Oracle Mobile Authenticator** app (available on iOS and Android) or any TOTP-compatible authenticator app
5. Scan the QR code and enter the verification code

> [!WARNING]
> Always enable 2FA to protect your Oracle Cloud account from unauthorized access.

### Add Administrator User

To add another user with full administrative privileges:

1. Sign in to the OCI Console as an administrator
2. Open the navigation menu and click **Identity & Security** > **Domains**
3. Click on the **Default** domain (or your custom domain)
4. In the domain details, click **Users** from the left menu
5. Click **Create user**
6. Enter user details:
   - First name and Last name
   - Email address (will be used as username)
   - Optionally check **Use email address as the username**
7. Click **Create**

8. After user creation, click **Groups** from the left menu
9. Click on the **Administrators** group
10. Click **Add user to group**
11. Select the newly created user and click **Add**

12. The new user will receive an email with activation instructions
13. They must set their password and enable 2FA upon first sign-in

> [!NOTE]
> Users in the Administrators group have full access to all OCI resources and services in your tenancy.
