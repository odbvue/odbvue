# OdbVue

OdbVue is a template + reference implementation for building and deploying business-class apps with **Oracle AI Database** and **Vue 3**.

- Demo: https://apps.odbvue.com
- Documentation: https://wiki.odbvue.com

## Quick start (local DB + apps)

Prerequisites:

- Node.js: `^20.19.0` or `>=22.12.0`
- pnpm: `10.x`
- Podman (for local Oracle ADB Free container)
- Oracle SQLcl (`sql` on PATH)

From the repo root:

```sh
# 1) build + link the ov CLI
cd cli
pnpm install
pnpm build
pnpm link -g

# 2) start local DB, generate local config, download wallet
cd ..
ov local-setup

# 3) install/upgrade schema + objects
ov db-install-local

# 4) start app + wiki dev servers
ov dev
```

Open the URLs shown in the terminal (typically `http://localhost:5173` for the app and `http://localhost:5174` for the wiki).

## Repo layout

- `apps/` – main Vue 3 + Vite app (also contains the VitePress docs tooling)
- `db/` – database artifacts (SQL/PLSQL) and deployment helpers
- `i13e/` – infrastructure examples for local + cloud deployments
- `cli/` – `ov` helper CLI
- `main/` – static landing page template

## License

MIT — see [LICENSE](/LICENSE).
