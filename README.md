# OdbVue

OdbVue is a template + reference implementation for building and deploying business-class apps with **Oracle AI Database** and **VueJs**.

- Demo: https://apps.odbvue.com
- Documentation: https://wiki.odbvue.com

---

![OdbVue](apps/public/pwa-64x64.png)

[Why OdbVue?](https://wiki.odbvue.com/introduction/vision.html)

## Quick start (local DB + apps)

Prerequisites:

- [Node.js `^20.19.0` or `>=22.12.0`](https://nodejs.org/en/download)
- [pnpm: `10.x`](https://pnpm.io/installation)
- [Podman](https://podman.io/docs/installation)
- [Oracle SQLcl](https://www.oracle.com/database/sqldeveloper/technologies/sqlcl/download/)

From the repo root:

```sh
# 0) clone project 
git clone https://github.com/odbvue/odbvue.git
cd odbvue

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
cd apps
pnpm install
pnpm exec playwright install 
cd ..
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

MIT - see [LICENSE](/LICENSE).
