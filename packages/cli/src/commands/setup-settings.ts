import { Command } from 'commander'

import { runSetupSettings } from '../app/setup-settings.js'
import { logger } from '../shared/logger.js'

export const registerSetupSettingsCommand = (program: Command) => {
  program
    .command('setup-settings')
    .alias('ss')
    .description(
      'Configure SMTP, JWT, application URL, and optional Google sign-in settings and network ACLs',
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
