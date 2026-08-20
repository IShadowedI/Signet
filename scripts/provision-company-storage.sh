#!/usr/bin/env bash
set -euo pipefail

ROOT=/var/lib/signet
install -d -o signetadmin -g signetadmin -m 0750 "$ROOT/base" "$ROOT/companies/signature-imagewear/uploads" "$ROOT/companies/signature-imagewear/exports" "$ROOT/backups"

# A fresh out-of-the-box database snapshot is kept separately from client data.
sudo -u postgres pg_dump signet >"$ROOT/base/signet-fresh.sql"
chown signetadmin:signetadmin "$ROOT/base/signet-fresh.sql"
chmod 0640 "$ROOT/base/signet-fresh.sql"

echo "Base snapshot: $ROOT/base/signet-fresh.sql"
echo "Signature Imagewear storage: $ROOT/companies/signature-imagewear"
