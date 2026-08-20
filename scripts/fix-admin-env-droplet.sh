#!/usr/bin/env bash
set -euo pipefail
cat >/opt/signet/apps/admin/.env <<'EOF'
NEXT_PUBLIC_API_URL=http://161.35.109.204
EOF
chown signetadmin:signetadmin /opt/signet/apps/admin/.env
chmod 600 /opt/signet/apps/admin/.env
runuser -u signetadmin -- bash -c 'cd /opt/signet && npm run build --workspace @signet/admin'
systemctl restart signet-admin
