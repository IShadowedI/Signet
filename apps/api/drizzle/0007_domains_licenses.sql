-- Phase: custom domains + store licensing.
-- Domain already exists on tenants; add licensing columns for client stores.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS license_key text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS license_status text NOT NULL DEFAULT 'active';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS license_expires_at timestamp;
