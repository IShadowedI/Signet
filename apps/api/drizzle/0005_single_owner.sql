-- Signet has exactly one global owner account. Company staff use admin or employee roles.
DELETE FROM internal_users
WHERE role = 'owner' AND username <> 'signet-owner';
