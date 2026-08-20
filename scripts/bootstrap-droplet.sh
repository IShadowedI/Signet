#!/usr/bin/env bash
set -euo pipefail

IP_ADDRESS="161.35.109.204"
APP_USER="signetadmin"
APP_DIR="/opt/signet"
REPOSITORY="https://github.com/IShadowedI/Signet.git"
SSH_PUBLIC_KEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIM8Avrlwwpv3HqayWL1c3mNxcnqTh0YQjguLU4eidxPE shado@Surface"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y
apt-get install -y ca-certificates curl git gpg ufw nginx postgresql postgresql-contrib

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
printf 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main\n' >/etc/apt/sources.list.d/nodesource.list
apt-get update
apt-get install -y nodejs
npm install -g pm2

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "${APP_USER}"
  usermod -aG sudo "${APP_USER}"
fi
install -d -m 0700 -o "${APP_USER}" -g "${APP_USER}" "/home/${APP_USER}/.ssh"
printf '%s\n' "${SSH_PUBLIC_KEY}" >"/home/${APP_USER}/.ssh/authorized_keys"
chown "${APP_USER}:${APP_USER}" "/home/${APP_USER}/.ssh/authorized_keys"
chmod 0600 "/home/${APP_USER}/.ssh/authorized_keys"

DB_PASSWORD="$(openssl rand -hex 24)"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
CREATE ROLE signet LOGIN PASSWORD '${DB_PASSWORD}';
CREATE DATABASE signet OWNER signet;
SQL

if [[ -d "${APP_DIR}/.git" ]]; then
  sudo -u "${APP_USER}" git -C "${APP_DIR}" pull --ff-only origin main
else
  git clone "${REPOSITORY}" "${APP_DIR}"
  chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
fi

cat >"${APP_DIR}/apps/api/.env" <<ENV
API_PORT=4000
CORS_ORIGINS=http://${IP_ADDRESS},http://${IP_ADDRESS}:3001
AUTH_JWT_SECRET=$(openssl rand -hex 32)
STOREFRONT_URL=http://${IP_ADDRESS}
DATABASE_URL=postgresql://signet:${DB_PASSWORD}@localhost:5432/signet
ERP_PROVIDER=mock
ENV
cat >"${APP_DIR}/apps/storefront/.env" <<ENV
NEXT_PUBLIC_API_URL=http://${IP_ADDRESS}/api
ENV
cat >"${APP_DIR}/apps/admin/.env" <<ENV
NEXT_PUBLIC_API_URL=http://${IP_ADDRESS}/api
ENV
chown "${APP_USER}:${APP_USER}" "${APP_DIR}/apps/api/.env" "${APP_DIR}/apps/storefront/.env" "${APP_DIR}/apps/admin/.env"
chmod 0600 "${APP_DIR}/apps/api/.env" "${APP_DIR}/apps/storefront/.env" "${APP_DIR}/apps/admin/.env"

sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}' && npm ci && npm run db:setup && npm run db:seed && npm run build"

cat >/etc/nginx/sites-available/signet <<NGINX
server {
  listen 80 default_server;
  server_name _;

  location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
NGINX
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/signet /etc/nginx/sites-enabled/signet
nginx -t
systemctl enable --now nginx

sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}' && pm2 delete signet-api signet-storefront signet-admin || true && pm2 start 'npm run start --workspace @signet/api' --name signet-api && pm2 start 'npm run start --workspace @signet/storefront' --name signet-storefront && pm2 start 'npm run start --workspace @signet/admin' --name signet-admin && pm2 save"
pm2 startup systemd -u "${APP_USER}" --hp "/home/${APP_USER}"

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3001/tcp comment 'Signet admin dashboard'
ufw --force enable

printf '\nDeployment complete.\nStorefront: http://%s\nAdmin: http://%s:3001\nAPI health: http://%s/health\n' "${IP_ADDRESS}" "${IP_ADDRESS}" "${IP_ADDRESS}"
