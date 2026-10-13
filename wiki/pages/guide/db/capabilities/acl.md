# Network ACL

`odbAcl` installs the definer-rights `odb_acl` package. It manages HTTP and SMTP
host grants for its owning application schema, even when called by the CLI's
administrator connection. It does not accept an arbitrary principal.

## Install

```ts
import { defineMigration, odbAcl, odbSchema } from '@odbvue/odb'

export const schema = odbSchema('APP', schemaPassword, (definition) => {
  definition.grant('EXECUTE ON SYS.DBMS_NETWORK_ACL_ADMIN')
  definition.grant('SELECT ON SYS.DBA_HOST_ACES')
})

export const migration = defineMigration('20261011140000_acl', { schema: 'APP' }).install(odbAcl)
```

Supply `schemaPassword` from your environment. Schema/environment provisioning
must grant `EXECUTE ON SYS.DBMS_NETWORK_ACL_ADMIN` and
`SELECT ON SYS.DBA_HOST_ACES` directly to the application schema before compiling
the package. Run provisioning as an administrator permitted to grant these
privileges. Capability installation creates only database objects and does not
grant privileges, with or without a target schema.
Role-based grants are insufficient for definer-rights PL/SQL.

This is a privileged capability: the schema can administer network ACLs and read
the ACL dictionary. Do not grant untrusted database users execute access to
`odb_acl`. HTTP authorization belongs to the application; the sandbox exposes
all five operations only to the `admin` role.

## Calls

The helpers accept PL/SQL expressions, not plain hostname strings:

```ts
body.call(odbAcl.addHttp(host)) // exact port 443, privilege 'http'
body.call(odbAcl.removeHttp(host)) // exact port 443
body.call(odbAcl.addSmtp(host)) // exact port 587, privilege 'smtp'
body.call(odbAcl.removeSmtp(host)) // exact port 587
body.call(odbAcl.addSmtp(host, port)) // explicit exact port
body.call(odbAcl.list(items)) // OUT SYS_REFCURSOR
```

Omitting the port or passing SQL `NULL` selects 443 for HTTP and 587 for SMTP.
HTTP covers HTTPS too; no additional `connect` or `resolve` grant is added.
587 is the SMTP submission default; use an explicit port for providers using
25, 465, or another port. These grants do not configure TLS or credentials.

Hostnames and IPv4 addresses must be at most 255 characters, without URLs,
wildcards, or whitespace. Hosts are normalized to lowercase. Ports must be
integers from 1 through 65535. Invalid input raises an ODB validation error.
Adding an existing privilege is idempotent using Oracle's duplicate-ACE handling;
removing a missing matching grant is a no-op.

`list` returns the owner's non-inverted database-principal HTTP/SMTP grants,
ordered by `host`, `lowerPort`, `upperPort`, and `privilege`. Port bounds are
nullable for existing all-port grants. Existing range grants are also listed;
the simplified mutation API only manages exact-port grants. Denies, role grants,
and other principals or privileges are not modified.

Oracle's dictionary can return uppercase privilege names such as `SMTP`.
Listing and removal compare privileges case-insensitively; the sandbox displays
them in lowercase and allows selecting exact-port grants regardless of case.

ORDS serializes cursor port columns as `lower_port` and `upper_port`. The sandbox
maps those wire fields to its display model. Only explicit SQL `NULL` bounds
represent all-port grants; missing or invalid port fields produce an error.

Transactions belong to callers. `ov setup-settings` uses this capability to
add the configured SMTP host/port grant in the same transaction as its settings
writes. Setup does not remove previous grants; use the Network ACL page for that.
The CLI keeps only settings orchestration,
not embedded Oracle ACL administration SQL.

## Sandbox and upgrades

The sandbox Network ACL page lists grants and adds/removes exact-port HTTP or
SMTP grants through admin-only `/sandbox/acl` services.

Bootstrap provisions the direct prerequisite privileges through `definition.grant`
and installs `odbAcl`; the existing `pck_sandbox` package exposes its
admin-only services. These changes target a fresh database redeployment.
Editing already-applied migrations does not upgrade an existing database.
Regenerate the deployed OpenAPI manifest and web types after redeployment.

Uninstalling `odbAcl` drops the package, not existing host grants or the direct
schema privileges. Removing grants and privileges is an explicit
administrator operation.
