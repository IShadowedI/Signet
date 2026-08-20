#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/opt/signet
APP_USER=signetadmin

runuser -u "${APP_USER}" -- git -C "${APP_DIR}" pull --ff-only origin main
runuser -u "${APP_USER}" -- bash -c "cd '${APP_DIR}' && npm install && npm run build && npm run db:setup"
systemctl restart signet-api signet-storefront signet-admin
systemctl reload nginx
systemctl --no-pager --full status signet-api signet-storefront signet-admin | sed -n '1,80p'
