#!/bin/sh
set -eu

cd /var/www/mdv-api

if [ -f /var/www/mdv-api/.env ]; then
  set -a
  # shellcheck disable=SC1091
  . /var/www/mdv-api/.env
  set +a
fi

SYNC_KEY="${VPS_SYNC_KEY:-${VITE_VPS_SYNC_KEY:-}}"
RECONCILE_URL="${BLING_RECONCILE_URL:-https://www.mercadodovale.com.br/api/bling?resource=reconcile}"

if [ -z "${SYNC_KEY}" ]; then
  echo "BLING reconcile cron aborted: VPS_SYNC_KEY/VITE_VPS_SYNC_KEY missing" >&2
  exit 1
fi

curl -fsS \
  -H "x-sync-key: ${SYNC_KEY}" \
  "${RECONCILE_URL}"
