# Emails

`odbEmails` provides a database-backed SMTP queue, recipients, and storage-backed
attachments. The sandbox includes an administrator-only Emails page and services.

## Install

```ts
import { defineMigration, odbEmails, odbLob, odbSettings, odbStorage } from '@odbvue/odb'

export const migration = defineMigration('emails', { schema: 'APP' })
  .install(odbSettings)
  .install(odbLob)
  .install(odbStorage)
  .install(odbEmails)
```

The capability installs:

- `odb_emails_queue`: HTML content, subject, priority (1 highest through 5 lowest),
  status (`N` queued, `S` accepted by SMTP, `E` failed), timestamps, attempts,
  retry time, and last error.
- `odb_emails_addr`: `From`, `ReplyTo`, `To`, `Cc`, and `Bcc` addresses.
- `odb_emails_attc`: links to `odb_storage_files`, checked against the caller's
  owner ID when attached. Linked files cannot be deleted while referenced.
- `odb_emails`: PL/SQL API. The queue has a distinct name because Oracle tables
  and packages share an object namespace.

The package is defined in TypeScript using `odbPackage`, typed Oracle wrappers,
and query builders, including SMTP connection records, MIME streaming, and cleanup.
No separate PL/SQL source assets or raw SQL escape hatches are required.

The public `odbEmails` calls and installation order are unchanged. Existing
deployments need a package-only replacement migration; rebuilding the toolkit
or editing bootstrap does not update an installed database package. Replace only
the package, without reinstalling the queue, recipient, or attachment tables.

## SMTP configuration

Bootstrap seeds six separate settings in `odbSettings`, **all with empty values**:

| Setting          | Purpose                           | CLI prompt default |
| ---------------- | --------------------------------- | ------------------ |
| `SMTP_HOST`      | SMTP hostname (not a URL)         | None               |
| `SMTP_PORT`      | Integer port from 1 to 65535      | `587`              |
| `SMTP_USERNAME`  | SMTP authentication username      | None               |
| `SMTP_PASSWORD`  | SMTP authentication password      | None               |
| `SMTP_FROM_ADDR` | Sender and reply-to email address | `admin@odbvue.com` |
| `SMTP_FROM_NAME` | Sender and reply-to display name  | `Odbvue Admin`     |

After deploying the bootstrap migration, configure the current environment:

```sh
ov setup-settings
# Short alias:
ov ss
# Supply all or some values from a JSON file:
ov setup-settings .config/dev/settings.json
# Also supported:
ov setup settings .config/dev/settings.json
```

JSON keys are case-insensitive (`smtp_host`, `SMTP_HOST`, and `Smtp_Host` are
equivalent). The command also provisions [JWT configuration](./auth#jwt-configuration).
The supported keys are the six SMTP IDs above plus `AUTH_JWT_SECRET`,
`AUTH_JWT_ISSUER`, `AUTH_JWT_EXPIRATION_SECONDS`, and `APP_PUBLIC_URL`. For example:

```json
{
  "smtp_host": "smtp.email.eu-stockholm-1.oci.oraclecloud.com",
  "smtp_port": 587,
  "auth_jwt_issuer": "odbvue",
  "auth_jwt_expiration_seconds": 900,
  "app_public_url": "http://localhost:5173/"
}
```

The command applies file values and prompts only for missing settings, masking
the password when prompted. A complete SMTP file with JWT issuer, expiration,
and public application URL needs no prompts; the signing secret is optional and
freshly generated if omitted. Older files without `app_public_url` prompt for
that missing value, defaulting to `http://localhost:5173/`.
The port and JWT expiration must be JSON numbers; the other values must be strings.
Invalid values, unknown keys, and
duplicate keys differing only in case are rejected before any database changes.
Keep files containing credentials out of source control.

Without a file, the command prompts for the six SMTP values, JWT issuer, JWT
expiration (default 900 seconds), and public application URL (default
`http://localhost:5173/`). Use the actual HTTPS frontend URL in production.
The application URL must be an absolute HTTP(S) URL without credentials,
query strings, or fragments, and is used in signup confirmation emails.
It never prompts for or prints the signing key.
It connects using
the current environment's ADMIN wallet and credentials and uses
`ODBVUE_ADB_SCHEMA_USERNAME` as the settings owner and ACL principal. It writes
values through `odb_settings.write` using bind variables. It calls
[`odbAcl`](./acl) to add the `smtp` grant on the chosen host and port.
Setup does not read previous settings or remove old host grants; manage those
separately through the Network ACL page when needed.
SMTP, JWT, application URL, and ACL changes commit together or roll back on failure. Cancelling a
prompt changes nothing. Re-running updates all settings, including the JWT key;
an omitted signing secret generates a new random key.

The previous `smtp` JSON setting is no longer read. Existing deployments must
install the updated email package and seed the SMTP and JWT setting IDs before running
the command; editing bootstrap does not reapply an already deployed migration.
Do not reset an existing database just to configure SMTP.

Individual values can also be edited with the admin Settings page or, for example,
`PUT /sandbox/settings/SMTP_HOST`. Those edits do not update ACLs; use the CLI
when changing the host or port. The Network ACL sandbox page can manage grants
independently, but does not change SMTP settings. Do not place real credentials in migrations or
source control. `SMTP_PASSWORD` is marked `meta.secret = 'Y'` and encrypted by
[`odbSettings`](./settings); SMTP delivery reads the decrypted value internally.
Sandbox Settings list/get return `********` for secrets, and the editor accepts
only replacement values. Configure the Settings master key before running
`ov ss`. `SMTP_USERNAME` remains ordinary configuration.

Register the sender as an approved sender in OCI Email Delivery. Bootstrap grants
`EXECUTE ON UTL_SMTP` but does not create a host ACL while settings are empty.
Email composition requires a configured sender; delivery requires a host, valid
port, username, and password. Empty configuration raises
`EMAILS_SMTP_NOT_CONFIGURED`.

Delivery uses the legacy connection sequence: `UTL_SMTP.OPEN_CONNECTION(host, port)`,
then `UTL_SMTP.STARTTLS(connection)`, then PLAIN authentication over the encrypted
connection. No explicit EHLO calls, wallet, timeout, or secure-host options are
supplied; Oracle's connection defaults are used. Custom `walletPath` settings
are not used by this implementation. Local
environments also need outbound network connectivity and trusted SMTP certificates.

## API

```ts
odbEmails.mail('p_address', 'p_name', 'p_subject', 'p_content', 'p_priority', 'l_id')
odbEmails.addr('l_id', "'Cc'", 'p_address', 'p_name')
odbEmails.addr('l_id', "'Bcc'", 'p_private_address')
odbEmails.attc('l_id', 'p_owner_id', 'p_storage_id')
odbEmails.send('l_id') // Default retry delay: 300 seconds
odbEmails.send('l_id', '60')
odbEmails.list('p_after', 'p_limit', 'p_items')
```

`mail` creates the queue entry with sender/reply-to from settings and one recipient.
It rejects empty content, invalid priorities, and header injection. `addr` adds
recipients or replaces Reply-To. `attc` attaches an already stored file; call it
multiple times for multiple attachments. Content and attachment names support
UTF-8; Bcc addresses are used in the envelope but omitted from message headers.
Attachment names use percent-encoded UTF-8 continuation parameters, with at most
20 bytes per parameter; short names and final partial chunks are supported.

Composition uses the caller's transaction. **Commit the message and attachments
before calling `send`.** Delivery runs in an autonomous transaction so status
and errors survive a failing HTTP request without committing unrelated caller
work. Each attempt increments the counter. Success clears prior errors; failure
stores the error and a retry time, then raises the original exception.

There is no background scheduler or automatic retry. `postponed` is advisory;
manual retries can run immediately. Concurrent sends lock the queue entry, and
already-sent messages cannot be edited or resent. As with any SMTP client, a lost
connection around DATA acceptance can leave delivery uncertain; check provider
logs before retrying an ambiguous failure. `S` means accepted by the SMTP server,
not proof of arrival in the recipient's inbox.

`list` uses an ID cursor, ordered ascending, with a default limit of 50 and maximum 101. Authorization belongs to callers; the framework package is not HTTP-specific.

## Sandbox

All email services require the `admin` role:

- `POST /sandbox/emails`: `{ address, name, subject, content, priority, attachmentId }`
  queues, commits, and sends; returns `{ id }` only when SMTP accepts the message.
  `name` and `attachmentId` may be null. Attachments must belong to the signed-in user.
- `GET /sandbox/emails?limit=51&cursor=...`: delivery history without message bodies.
- `POST /sandbox/emails/:id/send`: send/retry an existing message.

The Emails page sends HTML with an optional file (up to the Storage limit of
10 MiB), shows history/errors, and supports manual retries. A failed SMTP attempt
remains in history even when the send request fails. Use **Retry** for that entry
instead of submitting the form again, which would create a new message.
Uploaded attachments remain in Storage, including after delivery or failed sends.
