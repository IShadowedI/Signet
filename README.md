# Signet

Multi-tenant B2B commerce with branded storefronts, an internal control dashboard,
ERP integration, and configurable client pages.

## Live deployment

[render.yaml](render.yaml) is a GitHub-connected Render Blueprint. Once deployed, it
creates these services:

- Storefront: `https://signet-storefront.onrender.com`
- Admin dashboard: `https://signet-admin.onrender.com`
- API health check: `https://signet-api.onrender.com/health`

Client URLs use `https://signet-storefront.onrender.com/store/<client-slug>`.
The seeded Ford storefront is `/store/ford` after the database is seeded.

## Deploy from GitHub

1. Open [Render Blueprints](https://dashboard.render.com/blueprints).
2. Select **New Blueprint Instance**, connect `IShadowedI/Signet`, and choose `main`.
3. Create the three web services and `signet-db` from the Blueprint.
4. If Render changes the default service names, update `STOREFRONT_URL`, `CORS_ORIGINS`,
   and `NEXT_PUBLIC_API_URL` to the generated URLs in the Render environment.
5. Seed demo data once from the API service shell:

   ```sh
   npm run db:seed --workspace @signet/api
   ```

Render applies migrations before API deployments. Configure production ERP credentials
in Render only when changing from the mock provider.

## Local development

```powershell
npm install
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/storefront/.env.example apps/storefront/.env
npm run db:setup
npm run db:seed
npm run dev
```

- Dashboard: `http://localhost:3001`
- Storefront: `http://localhost:3000/store/ford`
- API: `http://localhost:4000/health`

## Repository layout

```
apps/
  api/          Express + Drizzle API, authentication, orders, ERP sync
  storefront/   Next.js client storefronts
  admin/        Next.js internal control dashboard
packages/
  erp/          ERP provider abstraction
  site-templates/ Built-in HTML template library
```

Production uses Postgres through `DATABASE_URL`; local development uses PGlite unless
`DATABASE_URL` is set.
