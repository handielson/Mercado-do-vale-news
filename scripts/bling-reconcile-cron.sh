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

if [ -z "${SYNC_KEY}" ]; then
  echo "BLING reconcile cron aborted: VPS_SYNC_KEY/VITE_VPS_SYNC_KEY missing" >&2
  exit 1
fi

PORT="${PORT:-4000}"
case "${PORT}" in
  *[!0-9]*|'') echo 'BLING reconcile cron aborted: invalid local port' >&2; exit 1 ;;
esac

# The full reconciliation can exceed the public proxy timeout. Keep this job on
# the same VPS as the API and refuse overlapping hourly runs.
exec 9>"${BLING_RECONCILE_LOCK_FILE:-/tmp/mdv-bling-reconcile.lock}"
if ! flock -n 9; then
  echo '{"ok":true,"skipped":"previous_run_still_active"}'
  exit 0
fi

# A full live run currently includes disputed zero balances. Keep the hourly
# job read-only until its candidate changes have been reviewed explicitly.
DRY_RUN=true
if [ "${BLING_RECONCILE_APPLY:-false}" = 'true' ]; then
  DRY_RUN=false
fi
RECONCILE_URL="http://127.0.0.1:${PORT}/api/bling?resource=reconcile"
if [ "$DRY_RUN" = 'true' ]; then
  RECONCILE_URL="${RECONCILE_URL}&dryRun=true"
fi
if [ -n "${BLING_RECONCILE_SKU:-}" ]; then
  case "${BLING_RECONCILE_SKU}" in
    *[!A-Za-z0-9_-]*) echo 'BLING reconcile cron aborted: invalid SKU' >&2; exit 1 ;;
  esac
  RECONCILE_URL="${RECONCILE_URL}&sku=${BLING_RECONCILE_SKU}"
fi

BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT HUP INT TERM
if ! HTTP_CODE="$(curl --silent --show-error --connect-timeout 5 --max-time 3300 \
  --output "$BODY_FILE" --write-out '%{http_code}' \
  -H "x-sync-key: ${SYNC_KEY}" "${RECONCILE_URL}")"; then
  echo 'BLING reconcile cron failed: local API request failed' >&2
  exit 1
fi

node - "$BODY_FILE" "$HTTP_CODE" "$DRY_RUN" <<'NODE'
const fs = require('node:fs');
const [file, status, dryRunFlag] = process.argv.slice(2);
let response;
try { response = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch { console.error('BLING reconcile cron failed: invalid local API JSON'); process.exit(1); }
const dryRun = dryRunFlag === 'true';
const failedCount = Array.isArray(response.failed) ? response.failed.length : 0;
const ok = status === '200' && response.ok === true && failedCount === 0 && (!dryRun || response.dryRun === true);
console.log(JSON.stringify({ ok, dryRun, httpStatus:Number(status), planned:response.planned || null,
  applied:response.applied || null, failedCount, error:ok ? null : String(response.error || 'reconciliation_failed').slice(0, 160) }));
if (!ok) process.exit(1);
NODE
