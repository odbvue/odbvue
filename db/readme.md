# Database (SQL/PLSQL)

This folder contains the SQLcl project export (DDL), install scripts, and release changelogs used by the OdbVue API.

## Local database quick start (recommended)

OdbVue includes a ready-to-run local Oracle **ADB Free** container under `i13e/local/db`.

Prerequisites:

- Podman (or a compatible container runtime) with Compose support
- Oracle SQLcl (`sql` on PATH)

Notes:

- The local DB image is pulled from Oracle Container Registry (`container-registry.oracle.com`). The first run may require you to log in and accept the image terms.
- On Windows, Podman typically runs via WSL; ensure Podman Desktop/WSL integration is working.

From the repo root:

```sh
# guided setup: writes local passwords, starts DB, downloads wallet,
# creates cli/.env (ODBVUE_DB_CONN), db/.config.json (if missing), and apps/.env.local
ov local-setup

# install schema + objects into the local DB
ov db-install-local
```

After that, start the UI:

```sh
ov dev
```

## Config files

- `db/.config.json` (ignored by git): application + schema bootstrap config consumed by the install scripts.
	- Create it from `db/.config.json.example`.
	- Keep secrets here only for local dev; never commit it.

- `cli/.env` (ignored by git): local developer connection string used by `ov` commands.
	- Contains `ODBVUE_DB_CONN` (often using SQLcl `-cloudconfig <wallet.zip>`).

## Manual local DB (without ov)

If you prefer manual control:

```sh
cd i13e/local/db
cp .env.example .env
./build.sh
```

Then download the wallet:

```sh
./download-wallet.sh odbvue-db-dev ~/.wallets/odbvue/local.zip
```

Finally set `ODBVUE_DB_CONN` (example):

```dotenv
ODBVUE_DB_CONN="-cloudconfig ~/.wallets/odbvue/local.zip admin/<ADMIN_PASSWORD>@<TNS_ALIAS>"
```

## Notes

- The install entrypoint is `db/dist/install.sql` (used indirectly); the `ov db-install-local` command runs `db/dist/000_install.sql` + Liquibase changelog + `db/dist/999_install.sql`.
- For SQLcl project docs, see the SQLcl user guide (Database Application CI/CD).
