#!/usr/bin/env bash
set -euo pipefail

container="evolution_api"
instance="botmercadodovale"
state_dir="/var/lib/mdv-evolution-watchdog"
cooldown_seconds=300
mkdir -p "$state_dir"
exec 9>"/run/lock/mdv-evolution-watchdog.lock"
flock -n 9 || exit 0

log() { logger -t mdv-evolution-watchdog -- "$*"; }
if ! docker inspect "$container" >/dev/null 2>&1; then
  log "container $container not found"
  exit 1
fi

started_at="$(docker inspect -f '{{.State.StartedAt}}' "$container")"
logs="$(docker logs "$container" --since "$started_at" 2>&1 || true)"
if ! grep -Fq '[uncaughtException]' <<<"$logs" \
  || ! grep -Fq 'TypeError: terminated' <<<"$logs" \
  || ! grep -Eq 'UND_ERR_SOCKET|other side closed' <<<"$logs"; then
  exit 0
fi

now="$(date +%s)"
last_restart="$(cat "$state_dir/last_restart_epoch" 2>/dev/null || echo 0)"
if (( now - last_restart < cooldown_seconds )); then
  log "failure signature detected during cooldown; restart skipped"
  exit 0
fi

log "frozen Evolution socket detected; restarting $container once"
printf '%s' "$now" > "$state_dir/last_restart_epoch"
docker restart "$container" >/dev/null
sleep 8

if docker exec "$container" node -e "const base='http://127.0.0.1:8080';const h={apikey:process.env.AUTHENTICATION_API_KEY};Promise.all([fetch(base+'/instance/connectionState/$instance',{headers:h}).then(r=>r.ok?r.json():Promise.reject(Error('state '+r.status))),fetch(base+'/webhook/find/$instance',{headers:h}).then(r=>r.ok?r.json():Promise.reject(Error('webhook '+r.status)))]).then(([s,w])=>{if(String(s?.instance?.state||s?.state)!=='open')throw Error('instance not open');const u=String(w?.url||w?.webhook?.url||'');if(!u.includes('n8n.mercadodovale.com.br/webhook/whatsapp'))throw Error('unexpected webhook');}).catch(e=>{console.error(e.message);process.exit(1)})"; then
  log "recovery validated: connection open and webhook configured"
else
  log "restart completed but validation failed"
  exit 1
fi
