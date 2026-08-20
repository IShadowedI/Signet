#!/usr/bin/env bash
set -euo pipefail

cat >/etc/sudoers.d/signetadmin <<'EOF'
signetadmin ALL=(ALL) NOPASSWD:ALL
EOF
chmod 440 /etc/sudoers.d/signetadmin
visudo -cf /etc/sudoers.d/signetadmin

cat >/etc/ssh/sshd_config.d/99-signet-hardening.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
sshd -t
systemctl reload ssh
