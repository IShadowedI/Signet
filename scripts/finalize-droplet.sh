#!/usr/bin/env bash
set -euo pipefail

APP_USER=signetadmin
APP_DIR=/opt/signet

runuser -u "${APP_USER}" -- bash -c "cd '${APP_DIR}' && npm run db:setup"

cat >/etc/systemd/system/signet-api.service <<EOF
[Unit]
Description=Signet API
After=network.target postgresql.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=HOME=/home/${APP_USER}
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=PORT=4000
ExecStart=/usr/bin/npm run start --workspace @signet/api
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat >/etc/systemd/system/signet-storefront.service <<EOF
[Unit]
Description=Signet Storefront
After=network.target signet-api.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=HOME=/home/${APP_USER}
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=PORT=3000
ExecStart=/usr/bin/npm run start --workspace @signet/storefront
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat >/etc/systemd/system/signet-admin.service <<EOF
[Unit]
Description=Signet Admin Dashboard
After=network.target signet-api.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=HOME=/home/${APP_USER}
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=PORT=3001
ExecStart=/usr/bin/npm run start --workspace @signet/admin
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat >/etc/nginx/sites-available/signet <<'EOF'
server {
  listen 80 default_server;
  server_name _;

  location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location = /health {
    proxy_pass http://127.0.0.1:4000/health;
    proxy_set_header Host $host;
  }

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/signet /etc/nginx/sites-enabled/signet
nginx -t
systemctl daemon-reload
systemctl enable --now signet-api signet-storefront signet-admin nginx

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3001/tcp comment 'Signet admin dashboard'
ufw --force enable

systemctl --no-pager --full status signet-api signet-storefront signet-admin | sed -n '1,80p'
