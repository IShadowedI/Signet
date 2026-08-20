-- A top-level client company may own multiple branded satellite sites.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS parent_tenant_id text REFERENCES tenants(id) ON DELETE CASCADE;
