#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
pnpm install --frozen-lockfile
pnpm build
install -d /var/www/fitness
rsync -a --delete dist/ /var/www/fitness/
