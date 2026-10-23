import { Command } from 'commander'

import { runSetupSettings } from '../app/setup-settings.js'
import { logger } from '../shared/logger.js'

export const registerSetupSettingsCommand = (program: Command) => {
  program
    .command('setup-settings')
    .alias('ss')
    .description(
      'Configure SMTP, JWT, application URL, Google/LDAP sign-in settings and network ACLs',
    )
    .argument(
      '[file]',
      'JSON settings (case-insensitive); Google enable accepts Y/N or boolean; client ID aliases: GOOGLE_CLIENT_ID, VITE_GOOGLE_CLIENT_ID',
    )
    .addHelpText(
      'after',
      `
Google sign-in uses backend-owned authorization code OIDC, not frontend token verification.
AUTH_GOOGLE_ENABLED accepts "Y"/"N" or true/false; omitted values prompt (default: false).
Enabling requires AUTH_GOOGLE_CLIENT_ID and AUTH_GOOGLE_CLIENT_SECRET (masked prompt).
The redirect URI is derived automatically: loopback APP_PUBLIC_URL + /api/auth/google/callback
for development, or the configured runtime.apiUrl + /auth/google/callback for production.
Sign-in and linking share this callback and AUTH_GOOGLE_REDIRECT_URI.
Trailing slashes are normalized. Register the printed URI once in Google Cloud.
Do not supply AUTH_GOOGLE_REDIRECT_URI in the settings file.
HTTP callbacks are allowed only on localhost, 127.0.0.1, or [::1]. Credentials,
queries, fragments, whitespace, and backslashes are not allowed in callback URLs.
Outbound HTTPS uses database-managed TLS trust, with no application wallet setting.
Never store the client secret in frontend config.
Only enabled Google setup grants HTTPS ACLs for www.googleapis.com and
oauth2.googleapis.com on port 443. Disabling preserves saved Google credentials.
SMTP/JWT/application settings remain required. Existing JWT generation is unchanged.
AUTH_LDAP_ENABLED accepts true/false; omitted file values preserve the current policy.
Interactive setup offers LDAP disabled by default. When enabled, supply AUTH_LDAP_HOST,
AUTH_LDAP_PORT (default 389), AUTH_LDAP_BASE_DN, AUTH_LDAP_LOGIN_ATTRIBUTE (uid),
AUTH_LDAP_BIND_DN and AUTH_LDAP_BIND_PASSWORD.
AUTH_LDAP_TLS_ENABLED accepts true/false and is seeded false. Set true for verified
LDAPS and choose the correct port (normally 636). False skips OPEN_SSL: passwords
may be sent unencrypted. Use TLS for production. There is no automatic downgrade,
StartTLS, or transport inference from the port. Omitted file values preserve the saved mode.
AUTH_LDAP_WALLET_PATH (file:...) and AUTH_LDAP_WALLET_PASSWORD are optional and
may be empty or omitted. Autonomous Database ignores them and uses its managed
outbound trust wallet; standard Oracle may require an explicit trusted wallet.
Passwords are masked and stored as encrypted secret settings. When TLS is enabled,
server certificate authentication is required. Setup grants exact-host/port connect
access through odb_acl.add_ldap.
Only a successful LDAP search with zero entries allows local password fallback.
Wrong LDAP passwords, ambiguous searches, and directory/TLS errors never fall back.
`,
    )
    .action(async (file?: string) => {
      try {
        await runSetupSettings(file)
      } catch (error) {
        logger.fatal(error)
      }
    })
}
