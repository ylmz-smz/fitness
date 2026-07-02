#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
pnpm install --frozen-lockfile
pnpm build
install -d /var/www/fitness
rsync -a --delete dist/ /var/www/fitness/

if [ -f /etc/fitness-webhook.env ]; then
  install -m 0644 deploy/fitness-webhook.service /etc/systemd/system/fitness-webhook.service
  systemctl daemon-reload
  systemctl enable fitness-webhook.service
  systemctl restart fitness-webhook.service
fi
