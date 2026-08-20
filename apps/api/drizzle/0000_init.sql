-- Initial schema for the Signet commerce core.
-- Kept in sync with src/schema.ts. Safe to re-run (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "tenants" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "domain" text UNIQUE,
  "erp_customer_code" text,
  "primary_color" text NOT NULL DEFAULT '#0f172a',
  "accent_color" text NOT NULL DEFAULT '#2563eb',
  "logo_url" text,
  "hero_headline" text NOT NULL DEFAULT 'Company Store',
  "hero_subtext" text NOT NULL DEFAULT 'Official apparel and uniforms',
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "products" (
  "id" text PRIMARY KEY NOT NULL,
  "erp_id" text NOT NULL UNIQUE,
  "sku" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text,
  "brand" text,
  "image_url" text
);

CREATE TABLE IF NOT EXISTS "product_variants" (
  "id" text PRIMARY KEY NOT NULL,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "sku" text NOT NULL UNIQUE,
  "size" text,
  "color" text,
  "price" double precision NOT NULL,
  "available" integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "tenant_products" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "price_override" double precision,
  "allotment_eligible" boolean NOT NULL DEFAULT true,
  CONSTRAINT "tenant_products_tenant_id_product_id_unique" UNIQUE ("tenant_id", "product_id")
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "role" text NOT NULL DEFAULT 'buyer',
  "allotment_balance" double precision NOT NULL DEFAULT 0,
  CONSTRAINT "users_tenant_id_email_unique" UNIQUE ("tenant_id", "email")
);

CREATE TABLE IF NOT EXISTS "orders" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "user_id" text REFERENCES "users"("id"),
  "po_number" text,
  "status" text NOT NULL DEFAULT 'pending',
  "erp_order_id" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "order_lines" (
  "id" text PRIMARY KEY NOT NULL,
  "order_id" text NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "variant_sku" text NOT NULL,
  "quantity" integer NOT NULL,
  "unit_price" double precision NOT NULL
);
