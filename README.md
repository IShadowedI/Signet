## Live deployment

- Storefront: **http://161.35.109.204/store/ford**
- Admin dashboard: **http://161.35.109.204:3001**
- API health check: **http://161.35.109.204/health**

The live server runs Ubuntu, Postgres, Nginx, and systemd-managed Signet services.
Deployment administration uses the `signetadmin` SSH account; root and password SSH
login are disabled. Rebuild/deploy helpers are in [`scripts/`](scripts/).

The GitHub Pages site remains a static navigation preview only; the URLs above run the
functional application with the live API and database.
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
