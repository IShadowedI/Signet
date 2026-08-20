-- Phase 4: CimCloud-aligned invoice / quote / RMA pipelines + file-based template gallery.
-- Idempotent: safe to re-run.

-- ---- Invoices ----
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type text NOT NULL DEFAULT 'IN';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid double precision NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS po_number text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terms text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS memo text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS locked_until timestamp;
ALTER TABLE invoices ALTER COLUMN status SET DEFAULT 'open';
UPDATE invoices SET status = 'open' WHERE status = 'unpaid';
UPDATE invoices SET status = 'past_due' WHERE status = 'overdue';

CREATE TABLE IF NOT EXISTS payment_batches (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  amount double precision NOT NULL,
  surcharge double precision NOT NULL DEFAULT 0,
  method text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reference text,
  memo text,
  created_at timestamp NOT NULL DEFAULT now(),
  settled_at timestamp
);

ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS batch_id text REFERENCES payment_batches(id) ON DELETE SET NULL;
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'settled';
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS memo text;

-- ---- Quotes ----
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS total double precision NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS assigned_worker_email text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS converted_order_id text REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS expires_at timestamp;
ALTER TABLE quotes ALTER COLUMN status SET DEFAULT 'user_saved';
UPDATE quotes SET status = 'rep_queued' WHERE status = 'submitted';
UPDATE quotes SET status = 'rep_saved' WHERE status = 'approved';
UPDATE quotes SET status = 'cancelled' WHERE status = 'rejected';

CREATE TABLE IF NOT EXISTS quote_comments (
  id text PRIMARY KEY,
  quote_id text NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  author_type text NOT NULL,
  author_email text,
  body text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

-- ---- Returns (RMA) ----
CREATE TABLE IF NOT EXISTS return_reasons (
  id text PRIMARY KEY,
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS return_actions (
  id text PRIMARY KEY,
  label text NOT NULL,
  reason_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS return_stages (
  id text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_terminal boolean NOT NULL DEFAULT false
);

ALTER TABLE returns ADD COLUMN IF NOT EXISTS rma_number text;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS stage text;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS return_to_address text;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS carrier text;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS tracking_number text;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS approved_at timestamp;

ALTER TABLE return_lines ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE return_lines ADD COLUMN IF NOT EXISTS unit_price double precision NOT NULL DEFAULT 0;

-- ---- Ad-hoc requests ----
ALTER TABLE adhoc_requests ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';
ALTER TABLE adhoc_requests ADD COLUMN IF NOT EXISTS assigned_to_email text;
ALTER TABLE adhoc_requests ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();

-- ---- Site pages ----
ALTER TABLE site_pages ADD COLUMN IF NOT EXISTS js text NOT NULL DEFAULT '';
ALTER TABLE site_pages ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;
ALTER TABLE site_pages ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE site_pages ADD COLUMN IF NOT EXISTS seo_description text;
ALTER TABLE site_pages ADD COLUMN IF NOT EXISTS template_id text REFERENCES site_templates(id) ON DELETE SET NULL;

-- ---- Template gallery ----
ALTER TABLE site_templates ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE site_templates ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'General';
ALTER TABLE site_templates ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE site_templates ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE site_templates ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'upload';
ALTER TABLE site_templates ADD COLUMN IF NOT EXISTS entry_file text NOT NULL DEFAULT 'index.html';
ALTER TABLE site_templates ADD COLUMN IF NOT EXISTS file_count integer NOT NULL DEFAULT 0;
ALTER TABLE site_templates ADD COLUMN IF NOT EXISTS size_bytes integer NOT NULL DEFAULT 0;
ALTER TABLE site_templates ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;
ALTER TABLE site_templates ADD COLUMN IF NOT EXISTS uploaded_by_email text;
ALTER TABLE site_templates ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();

-- Backfill slugs for any pre-existing snippet templates before enforcing uniqueness.
UPDATE site_templates
SET slug = regexp_replace(lower(coalesce(name, 'template')), '[^a-z0-9]+', '-', 'g') || '-' || left(id, 6)
WHERE slug IS NULL;

ALTER TABLE site_templates ALTER COLUMN slug SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_templates_slug_unique') THEN
    ALTER TABLE site_templates ADD CONSTRAINT site_templates_slug_unique UNIQUE (slug);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS site_template_pages (
  id text PRIMARY KEY,
  template_id text NOT NULL REFERENCES site_templates(id) ON DELETE CASCADE,
  file text NOT NULL,
  path text NOT NULL,
  title text NOT NULL,
  is_home boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);
