#!/bin/bash
# =============================================================================
# synology-command-poller.sh
# Consome a fila de comandos da VPS e executa localmente no Synology.
# Usado pelo botão "Reiniciar tunnel" do painel admin.
#
# COMO CONFIGURAR NO AGENDADOR DE TAREFAS DO SYNOLOGY:
#   DSM → Painel de Controle → Agendador de Tarefas → Criar → Tarefa agendada
#   Nome:    synology-command-poller
#   Usuário: root
#   Agenda:  A cada 1 minuto (personalizado: */1 * * * *)
#   Comando: bash /volume1/scripts/synology-command-poller.sh
#
# INSTALAÇÃO:
#   1. Copie este arquivo para /volume1/scripts/synology-command-poller.sh
#   2. chmod +x /volume1/scripts/synology-command-poller.sh
#   3. Edite POLL_KEY abaixo com o mesmo valor de SYNOLOGY_POLL_KEY no .env da VPS
#   4. Configure no Agendador de Tarefas conforme acima
# =============================================================================

VPS_URL="https://api.xiaomipetrolina.com.br"
POLL_KEY="SUBSTITUA_PELA_MESMA_CHAVE_DO_VPS"
LOG_FILE="/tmp/synology-command-poller.log"
WATCHDOG_SCRIPT="/volume1/scripts/watchdog-cloudflared.sh"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# 1) Consulta fila
RESP=$(curl -s -m 5 -H "x-poll-key: $POLL_KEY" "$VPS_URL/synology/poll-command" 2>> "$LOG_FILE")
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
            log "ERRO: watchdog $WATCHDOG_SCRIPT não encontrado ou sem permissão de execução"
            RESULT="watchdog script missing"
        fi
        sleep 3
        if pgrep -f "cloudflared tunnel" > /dev/null; then
            PID=$(pgrep -f "cloudflared tunnel" | head -1)
            log "OK: cloudflared reiniciado (PID: $PID)"
            STATUS="success"
            RESULT="cloudflared restarted (PID: $PID)"
        else
            log "ERRO: cloudflared não subiu após restart"
            RESULT="${RESULT:-cloudflared failed to start}"
        fi
        ;;
    *)
        log "Comando desconhecido: $CMD"
        RESULT="unknown command: $CMD"
        ;;
esac

# 2) Confirma execução
curl -s -m 5 -X POST \
    -H "x-poll-key: $POLL_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"$ID\",\"status\":\"$STATUS\",\"result\":\"$RESULT\"}" \
    "$VPS_URL/synology/ack-command" >> "$LOG_FILE" 2>&1
