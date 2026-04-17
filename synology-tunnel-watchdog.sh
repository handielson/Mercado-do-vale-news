#!/bin/bash
# =============================================================================
# watchdog-cloudflared.sh
# Mantém o cloudflared rodando no Synology NAS.
#
# COMO CONFIGURAR NO AGENDADOR DE TAREFAS DO SYNOLOGY:
#   DSM → Painel de Controle → Agendador de Tarefas → Criar → Tarefa agendada → Script definido pelo usuário
#   Nome:    watchdog-cloudflared
#   Usuário: root
#   Agenda:  A cada 5 minutos (repetir a cada 5 min, sempre)
#   Comando: bash /volume1/scripts/watchdog-cloudflared.sh
#
# INSTALAÇÃO:
#   1. Copie este arquivo para /volume1/scripts/watchdog-cloudflared.sh no Synology
#   2. chmod +x /volume1/scripts/watchdog-cloudflared.sh
#   3. Configure no Agendador de Tarefas conforme acima
# =============================================================================

TUNNEL_ID="7680ed44-a7a9-4700-a37e-2026b3653360"
CLOUDFLARED_BIN="/usr/local/bin/cloudflared"
CONFIG_FILE="/usr/local/etc/cloudflared/config.yml"
LOG_FILE="/tmp/cloudflared-watchdog.log"
CRED_FILE="/usr/local/etc/cloudflared/${TUNNEL_ID}.json"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Verifica se cloudflared está rodando
if pgrep -f "cloudflared tunnel" > /dev/null 2>&1; then
    # Está rodando — verifica se o tunnel está conectado (checando o processo)
    log "OK: cloudflared rodando (PID: $(pgrep -f 'cloudflared tunnel' | head -1))"
    exit 0
fi

log "ALERTA: cloudflared nao esta rodando. Iniciando..."

# Garante que o binário existe
if [ ! -f "$CLOUDFLARED_BIN" ]; then
    log "ERRO: $CLOUDFLARED_BIN nao encontrado. Reinstalando..."
    curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" \
        -o "$CLOUDFLARED_BIN" 2>> "$LOG_FILE"
    chmod +x "$CLOUDFLARED_BIN"
fi

# Garante que a configuração existe
if [ ! -f "$CONFIG_FILE" ]; then
    log "ERRO: Config $CONFIG_FILE nao encontrada."
    exit 1
fi

# Inicia o tunnel em background
nohup "$CLOUDFLARED_BIN" tunnel --config "$CONFIG_FILE" run "$TUNNEL_ID" \
    >> /tmp/cloudflared.log 2>&1 &

sleep 3

if pgrep -f "cloudflared tunnel" > /dev/null 2>&1; then
    log "OK: cloudflared iniciado com sucesso (PID: $(pgrep -f 'cloudflared tunnel' | head -1))"
else
    log "ERRO: cloudflared nao conseguiu iniciar. Verifique /tmp/cloudflared.log"
fi
