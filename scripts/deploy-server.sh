#!/usr/bin/env bash
set -euo pipefail

# Deploy the React build/ to a plain Linux server with nginx.
#
# Assumptions:
# - You can SSH as root to the server IP
# - The server has your PUBLIC key in /root/.ssh/authorized_keys
# - You have the private key locally at ~/.ssh/id_ed25519 (NOT .pub)
#
# Usage:
#   ./scripts/deploy-server.sh
# Optional env overrides:
#   SERVER_IP=143.244.141.93 SSH_USER=root SSH_KEY=~/.ssh/id_ed25519 REMOTE_DIR=/var/www/hotel-app ./scripts/deploy-server.sh

SERVER_IP="${SERVER_IP:-143.244.141.93}"
SSH_USER="${SSH_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/hotel-app}"

if [[ ! -f "$SSH_KEY" ]]; then
  echo "Missing SSH private key at: $SSH_KEY" >&2
  echo "Note: you cannot use the .pub file for SSH. Use ~/.ssh/id_ed25519" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Building frontend…"
npm install
npm run build

echo "Uploading build/ to ${SSH_USER}@${SERVER_IP}:${REMOTE_DIR}…"
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SERVER_IP}" "mkdir -p '$REMOTE_DIR'"
rsync -avz --delete -e "ssh -i \"$SSH_KEY\"" ./build/ "${SSH_USER}@${SERVER_IP}:${REMOTE_DIR}/"

echo "Ensuring nginx is installed and configured…"
ssh -i "$SSH_KEY" "${SSH_USER}@${SERVER_IP}" bash -s <<EOF
set -euo pipefail

apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y nginx

mkdir -p "$REMOTE_DIR"
chown -R www-data:www-data "$REMOTE_DIR" || true

cat >/etc/nginx/sites-available/hotel-app <<'NGINXEOF'
server {
  listen 80;
  server_name ${SERVER_IP};

  root ${REMOTE_DIR};
  index index.html;

  location / {
    try_files \$uri /index.html;
  }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/hotel-app /etc/nginx/sites-enabled/hotel-app
rm -f /etc/nginx/sites-enabled/default || true

nginx -t
systemctl reload nginx
EOF

echo "Done."
echo "Open: http://${SERVER_IP}/"

