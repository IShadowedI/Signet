-- Company-scoped internal staff accounts: owner | admin | employee.
ALTER TABLE internal_users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE internal_users ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id) ON DELETE CASCADE;

-- Existing internal accounts stay usable while receiving an immutable username.
UPDATE internal_users
SET username = regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9]+', '-', 'g') || '-' || left(id, 6)
WHERE username IS NULL;

ALTER TABLE internal_users ALTER COLUMN username SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'internal_users_username_unique') THEN
    ALTER TABLE internal_users ADD CONSTRAINT internal_users_username_unique UNIQUE (username);
  END IF;
END $$;
