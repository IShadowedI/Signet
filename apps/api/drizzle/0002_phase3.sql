-- Phase 3: online invoicing, quotes, returns/ad-hoc requests, shipments,
-- order approvals (employee enablement), and the multi-page site builder.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS require_approval boolean NOT NULL DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS approval_threshold double precision NOT NULL DEFAULT 0;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_by_user_id text REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_at timestamp;

CREATE TABLE IF NOT EXISTS invoices (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id text REFERENCES orders(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  amount double precision NOT NULL,
  status text NOT NULL DEFAULT 'unpaid',
  due_date timestamp,
  issued_at timestamp NOT NULL DEFAULT now(),
  paid_at timestamp
);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id text PRIMARY KEY,
  invoice_id text NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount double precision NOT NULL,
  method text NOT NULL,
  reference text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quotes (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  quote_number text NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quote_lines (
  id text PRIMARY KEY,
  quote_id text NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  sku text NOT NULL,
  description text,
  quantity integer NOT NULL,
  unit_price double precision NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS returns (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id text REFERENCES orders(id) ON DELETE SET NULL,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  reason text,
  status text NOT NULL DEFAULT 'requested',
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS return_lines (
  id text PRIMARY KEY,
  return_id text NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  variant_sku text NOT NULL,
  quantity integer NOT NULL,
  reason text
);

CREATE TABLE IF NOT EXISTS adhoc_requests (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  type text NOT NULL,
  subject text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shipments (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  carrier text,
  tracking_number text,
  status text NOT NULL DEFAULT 'pending',
  shipped_at timestamp,
  delivered_at timestamp
);

CREATE TABLE IF NOT EXISTS site_pages (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  path text NOT NULL,
  title text NOT NULL,
  html text NOT NULL DEFAULT '',
  css text NOT NULL DEFAULT '',
  is_home boolean NOT NULL DEFAULT false,
  updated_by_email text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, path)
);

CREATE TABLE IF NOT EXISTS site_templates (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  html text NOT NULL DEFAULT '',
  css text NOT NULL DEFAULT '',
  created_at timestamp NOT NULL DEFAULT now()
);
