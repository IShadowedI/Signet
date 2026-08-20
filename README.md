# Signet

A multi-tenant B2B apparel commerce platform — a customizable replacement for Signet.

One deployment serves many **branded client storefronts** (e.g. Ford, Acme) resolved by
hostname, backed by a shared commerce core and a pluggable **ERP integration layer**
(Acumatica first; Sage and others slot in later).

## Why this shape

Signet has you running a separate site per client (~50 sites to maintain). Signet flips
that: **one codebase, many tenants**. Each client gets its own domain, theme, catalog and
pricing, but you maintain a single system.

## Repo layout

```
packages/
  erp/          ErpProvider interface + MockErpProvider + AcumaticaErpProvider
apps/
  api/          Express + Drizzle commerce API (catalog, tenants, orders, ERP sync)
  storefront/   Next.js multi-tenant storefront (per-tenant theme + catalog)
```

**Data layer:** Drizzle ORM. Local dev uses **PGlite** (an embedded Postgres
compiled to WebAssembly — zero setup, no native binaries, works on any CPU
architecture including Windows ARM64). Production uses real **Postgres** via
`node-postgres`; set `DATABASE_URL` and the same code targets it.

## Quick start

```powershell
# 1. install
npm install

# 2. copy per-app env files
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/storefront/.env.example apps/storefront/.env

# 3. create + seed the local DB (embedded Postgres via PGlite)
npm run db:setup      # generate + apply Drizzle migrations
npm run db:seed       # creates demo tenants "ford" and "acme" with products

# 4. run api + storefront together
npm run dev
```

Then open the storefront and switch tenants (dev resolves tenant by the `?tenant=` query
param or the `x-tenant` header; in production it resolves by hostname/subdomain):

- http://localhost:3000/?tenant=ford
- http://localhost:3000/?tenant=acme

API runs on http://localhost:4000.

## Switching from mock ERP to Acumatica

Set `ERP_PROVIDER=acumatica` in `.env` and fill in the `ACUMATICA_*` values. The API talks
to Acumatica's contract-based REST API through `packages/erp`; no storefront changes needed.

## Production notes

- Move to Postgres by setting `DATABASE_URL` (e.g. the Postgres from
  `docker-compose.yml`); the API auto-switches from PGlite to `node-postgres`.
- The storefront is stateless and multi-tenant; deploy once behind wildcard DNS
  (`*.yourdomain.com`) or map each client's custom domain to the same app.
- Docker Compose (`docker-compose.yml`) provides a Postgres instance for droplet hosting.
