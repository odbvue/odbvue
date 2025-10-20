# Sign up to Oracle Cloud

## Account Registration

### Step 1: Start Registration

Navigate to [cloud.oracle.com](https://cloud.oracle.com) and click **Sign Up for Free Tier**.

![Oracle Cloud Sign Up Page]()

### Step 2: Enter Account Details

Fill in the required information:
- Cloud account name (unique identifier)
- Country/Territory
- Email address

Verify your email by clicking the link sent to your inbox.

![Account Details Form]()

### Step 3: Configure Account Settings

Complete your account setup:
- Create a strong password
- Confirm your cloud account name
- Select your home region (e.g., US East - Ashburn, Germany - Frankfurt)

> [!TIP]
> Choose a region closest to your location for optimal performance. This cannot be changed later.

![Account Configuration]()

### Step 4: Enter Personal Information

Provide your address and contact details.

![Address Information]()

### Step 5: Phone Verification

Enter your mobile number with the correct country code and verify via SMS code.

![Phone Verification]()

### Step 6: Accept Terms

Review and accept the Oracle Cloud Free Tier terms and conditions, then click **Start My Free Trial**.

![Terms and Conditions]()

### Step 7: Account Activation

Your account is created immediately. You'll receive:
- Welcome email with sign-in credentials
- Confirmation email when all services are provisioned (typically within minutes)

![Account Activation Confirmation]()

## Security Setup

### Enable Two-Factor Authentication (2FA)

For enhanced security, enable 2FA immediately after account creation:

1. Sign in to your Oracle Cloud account
2. Navigate to **Profile** > **My Profile** > **Security**
3. Enable **Multi-Factor Authentication (MFA)**
4. Use the **Oracle Mobile Authenticator** app (available on iOS and Android) or any TOTP-compatible authenticator app
5. Scan the QR code and enter the verification code

![2FA Setup]()

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

![Create User]()

8. After user creation, click **Groups** from the left menu
9. Click on the **Administrators** group
10. Click **Add user to group**
11. Select the newly created user and click **Add**

![Add User to Administrators Group]()

12. The new user will receive an email with activation instructions
13. They must set their password and enable 2FA upon first sign-in

> [!NOTE]
> Users in the Administrators group have full access to all OCI resources and services in your tenancy.
