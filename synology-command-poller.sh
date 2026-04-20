#!/bin/bash
# =============================================================================
# synology-command-poller.sh
# Consome a fila de comandos da VPS e executa localmente no Synology.
# Também reporta heartbeat do NAS para a VPS a cada execucao.
#
# COMO CONFIGURAR NO AGENDADOR DE TAREFAS DO SYNOLOGY:
#   DSM -> Painel de Controle -> Agendador de Tarefas -> Criar -> Tarefa agendada
#   Nome:    synology-command-poller
#   Usuario: root
#   Agenda:  A cada 1 minuto (personalizado: */1 * * * *)
#   Comando: bash /volume1/scripts/synology-command-poller.sh
#
# INSTALACAO:
#   1. Copie este arquivo para /volume1/scripts/synology-command-poller.sh
#   2. chmod +x /volume1/scripts/synology-command-poller.sh
#   3. Edite POLL_KEY abaixo com o mesmo valor de SYNOLOGY_POLL_KEY no .env da VPS
#   4. Configure no Agendador de Tarefas conforme acima
# =============================================================================

VPS_URL="https://api.xiaomipetrolina.com.br"
POLL_KEY="SUBSTITUA_PELA_MESMA_CHAVE_DO_VPS"
LOG_FILE="/tmp/synology-command-poller.log"
WATCHDOG_SCRIPT="/volume1/scripts/watchdog-cloudflared.sh"
SCHEDULED_REBOOT_ENABLED="true"
SCHEDULED_REBOOT_LABEL="Domingo 04:00"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

json_escape() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

meminfo_kb() {
    awk -v key="$1" '$1 == key ":" { print $2; exit }' /proc/meminfo 2>/dev/null
}

kb_to_mb() {
    local value="${1:-0}"
    case "$value" in
        ''|*[!0-9]*) value=0 ;;
    esac
    echo $(( (value + 512) / 1024 ))
}

collect_status_payload() {
    local hostname_value model_value uptime_seconds timestamp
    local mem_total_kb mem_available_kb mem_free_kb mem_buffers_kb mem_cached_kb mem_sreclaimable_kb
    local swap_total_kb swap_free_kb
    local mem_used_kb swap_used_kb
    local mem_total_mb mem_used_mb mem_available_mb swap_total_mb swap_used_mb swap_free_mb
    local cached_mb buffers_mb slab_mb

    hostname_value=$(hostname 2>/dev/null | tr -d '\r\n')
    [ -n "$hostname_value" ] || hostname_value="Synology NAS"

    model_value=$(cat /proc/sys/kernel/syno_hw_version 2>/dev/null | tr -d '\r\n')
    [ -n "$model_value" ] || model_value="unknown"

    uptime_seconds=$(awk '{ print int($1) }' /proc/uptime 2>/dev/null)
    case "$uptime_seconds" in
        ''|*[!0-9]*) uptime_seconds=0 ;;
    esac

    mem_total_kb=$(meminfo_kb MemTotal)
    mem_available_kb=$(meminfo_kb MemAvailable)
    mem_free_kb=$(meminfo_kb MemFree)
    mem_buffers_kb=$(meminfo_kb Buffers)
    mem_cached_kb=$(meminfo_kb Cached)
    mem_sreclaimable_kb=$(meminfo_kb SReclaimable)
    swap_total_kb=$(meminfo_kb SwapTotal)
    swap_free_kb=$(meminfo_kb SwapFree)

    case "$mem_total_kb" in ''|*[!0-9]*) mem_total_kb=0 ;; esac
    case "$mem_available_kb" in ''|*[!0-9]*) mem_available_kb=0 ;; esac
    case "$mem_free_kb" in ''|*[!0-9]*) mem_free_kb=0 ;; esac
    case "$mem_buffers_kb" in ''|*[!0-9]*) mem_buffers_kb=0 ;; esac
    case "$mem_cached_kb" in ''|*[!0-9]*) mem_cached_kb=0 ;; esac
    case "$mem_sreclaimable_kb" in ''|*[!0-9]*) mem_sreclaimable_kb=0 ;; esac
    case "$swap_total_kb" in ''|*[!0-9]*) swap_total_kb=0 ;; esac
    case "$swap_free_kb" in ''|*[!0-9]*) swap_free_kb=0 ;; esac

    if [ "$mem_available_kb" -le 0 ] && [ "$mem_total_kb" -gt 0 ]; then
        mem_available_kb=$(( mem_free_kb + mem_buffers_kb + mem_cached_kb + mem_sreclaimable_kb ))
    fi

    if [ "$mem_available_kb" -gt "$mem_total_kb" ]; then
        mem_available_kb="$mem_total_kb"
    fi

    mem_used_kb=$(( mem_total_kb - mem_available_kb ))
    [ "$mem_used_kb" -ge 0 ] || mem_used_kb=0

    swap_used_kb=$(( swap_total_kb - swap_free_kb ))
    [ "$swap_used_kb" -ge 0 ] || swap_used_kb=0

    mem_total_mb=$(kb_to_mb "$mem_total_kb")
    mem_used_mb=$(kb_to_mb "$mem_used_kb")
    mem_available_mb=$(kb_to_mb "$mem_available_kb")
    swap_total_mb=$(kb_to_mb "$swap_total_kb")
    swap_used_mb=$(kb_to_mb "$swap_used_kb")
    swap_free_mb=$(kb_to_mb "$swap_free_kb")
    cached_mb=$(kb_to_mb "$mem_cached_kb")
    buffers_mb=$(kb_to_mb "$mem_buffers_kb")
    slab_mb=$(kb_to_mb "$mem_sreclaimable_kb")
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    printf '{"timestamp":"%s","hostname":"%s","model":"%s","uptime_seconds":%s,"memory":{"total_mb":%s,"used_mb":%s,"available_mb":%s},"swap":{"total_mb":%s,"used_mb":%s,"free_mb":%s},"cache":{"cached_mb":%s,"buffers_mb":%s,"slab_mb":%s},"scheduled_reboot":{"enabled":%s,"label":"%s"}}' \
        "$(json_escape "$timestamp")" \
        "$(json_escape "$hostname_value")" \
        "$(json_escape "$model_value")" \
        "$uptime_seconds" \
        "$mem_total_mb" \
        "$mem_used_mb" \
        "$mem_available_mb" \
        "$swap_total_mb" \
        "$swap_used_mb" \
        "$swap_free_mb" \
        "$cached_mb" \
        "$buffers_mb" \
        "$slab_mb" \
        "$SCHEDULED_REBOOT_ENABLED" \
        "$(json_escape "$SCHEDULED_REBOOT_LABEL")"
}

report_status() {
    local payload
    payload=$(collect_status_payload)
    if curl -fsS -m 5 -X POST \
        -H "x-poll-key: $POLL_KEY" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$VPS_URL/synology/report-status" >> "$LOG_FILE" 2>&1; then
        log "Heartbeat do NAS enviado"
    else
        log "ERRO: falha ao enviar heartbeat do NAS"
    fi
}

ack_command() {
    local id="$1"
    local status="$2"
    local result="$3"
    local payload
    payload=$(printf '{"id":"%s","status":"%s","result":"%s"}' \
        "$(json_escape "$id")" \
        "$(json_escape "$status")" \
        "$(json_escape "$result")")

    curl -fsS -m 5 -X POST \
        -H "x-poll-key: $POLL_KEY" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$VPS_URL/synology/ack-command" >> "$LOG_FILE" 2>&1
}

report_status

# 1) Consulta fila
RESP=$(curl -fsS -m 5 -H "x-poll-key: $POLL_KEY" "$VPS_URL/synology/poll-command" 2>> "$LOG_FILE")
if [ -z "$RESP" ]; then
    exit 0
fi

CMD=$(echo "$RESP" | grep -oE '"command":"[^"]+"' | sed -E 's/.*"command":"([^"]+)".*/\1/')
ID=$(echo "$RESP" | grep -oE '"id":"[^"]+"' | sed -E 's/.*"id":"([^"]+)".*/\1/')

if [ -z "$CMD" ] || [ "$CMD" = "null" ]; then
    exit 0
fi

log "Comando recebido: $CMD (id=$ID)"

STATUS="failed"
RESULT=""

case "$CMD" in
    restart-cloudflared)
        log "Reiniciando cloudflared..."
        pkill -f "cloudflared tunnel" 2>> "$LOG_FILE"
        sleep 2
        if [ -x "$WATCHDOG_SCRIPT" ]; then
            bash "$WATCHDOG_SCRIPT" >> "$LOG_FILE" 2>&1
        else
            log "ERRO: watchdog $WATCHDOG_SCRIPT nao encontrado ou sem permissao de execucao"
            RESULT="watchdog script missing"
        fi
        sleep 3
        if pgrep -f "cloudflared tunnel" > /dev/null; then
            PID=$(pgrep -f "cloudflared tunnel" | head -1)
            log "OK: cloudflared reiniciado (PID: $PID)"
            STATUS="success"
            RESULT="cloudflared restarted (PID: $PID)"
        else
            log "ERRO: cloudflared nao subiu apos restart"
            RESULT="${RESULT:-cloudflared failed to start}"
        fi
        ack_command "$ID" "$STATUS" "$RESULT"
        ;;
    reboot-nas)
        RESULT="NAS reboot iniciado via poller"
        if ack_command "$ID" "success" "$RESULT"; then
            log "ACK de reboot enviado com sucesso; reiniciando NAS..."
        else
            log "ERRO: falha ao enviar ACK de reboot"
        fi
        sleep 1
        /sbin/reboot
        ;;
    *)
        log "Comando desconhecido: $CMD"
        RESULT="unknown command: $CMD"
        ack_command "$ID" "failed" "$RESULT"
        ;;
esac
