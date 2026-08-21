## Live deployment

- Storefront: **http://161.35.109.204/store/ford**
- Admin dashboard: **http://161.35.109.204:3001**
- Owner sign in: **http://161.35.109.204:3001/login**
- Company staff sign in: **http://161.35.109.204:3001/staff/login**
- API health check: **http://161.35.109.204/health**
## Local development

```powershell
npm install
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/storefront/.env.example apps/storefront/.env
npm run db:setup
npm run db:seed
npm run dev
```

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
