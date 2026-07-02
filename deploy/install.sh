#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
corepack pnpm install --frozen-lockfile
corepack pnpm build
install -d /var/www/fitness
rsync -a --delete dist/ /var/www/fitness/
