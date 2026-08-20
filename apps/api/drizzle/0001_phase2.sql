-- Phase 2: auth, uniform allotments, CRM tabs, punchout.
-- Kept in sync with src/schema.ts. Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "internal_users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "name" text NOT NULL,
  "role" text NOT NULL DEFAULT 'ops',
  "created_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "page_blocks" jsonb NOT NULL DEFAULT '[]';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "punchout_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "punchout_shared_secret" text;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_method" text NOT NULL DEFAULT 'po';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "punchout_session_id" text;

CREATE TABLE IF NOT EXISTS "allotment_transactions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" double precision NOT NULL,
  "reason" text NOT NULL,
  "order_id" text REFERENCES "orders"("id"),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "contacts" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "title" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "addresses" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "label" text,
  "line1" text NOT NULL,
  "line2" text,
  "city" text NOT NULL,
  "state" text NOT NULL,
  "postal_code" text NOT NULL,
  "country" text NOT NULL DEFAULT 'US',
  "is_default" boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS "payment_methods" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "brand" text NOT NULL,
  "last4" text NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "saved_searches" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "query" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "credential_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "type" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "search_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "query" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "product_interactions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "product_id" text REFERENCES "products"("id") ON DELETE SET NULL,
  "type" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "page_views" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "path" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "punchout_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE,
  "buyer_cookie" text,
  "browser_form_post_url" text NOT NULL,
  "status" text NOT NULL DEFAULT 'open',
  "created_at" timestamp NOT NULL DEFAULT now()
);
