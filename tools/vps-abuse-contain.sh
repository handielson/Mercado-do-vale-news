#!/usr/bin/env bash
set -euo pipefail

APPLY=0
TARGET_PID="${TARGET_PID:-}"
TARGET_PATH="${TARGET_PATH:-}"
TARGET_SERVICE="${TARGET_SERVICE:-}"
TARGET_CONTAINER="${TARGET_CONTAINER:-}"
TARGET_PATTERN="${TARGET_PATTERN:-xmrig-restore|xmrig|systemd-bench|bench\\.json|kdevtmpfsi|kinsing}"
TARGET_DIR="${TARGET_DIR:-/etc/xmrig-restore}"
BACKUP_DIR="${BACKUP_DIR:-/root/mdv-abuse-containment-$(date +%Y%m%d-%H%M%S)}"

for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    --pid=*) TARGET_PID="${arg#--pid=}" ;;
    --path=*) TARGET_PATH="${arg#--path=}" ;;
    --service=*) TARGET_SERVICE="${arg#--service=}" ;;
    --container=*) TARGET_CONTAINER="${arg#--container=}" ;;
    --pattern=*) TARGET_PATTERN="${arg#--pattern=}" ;;
    --dir=*) TARGET_DIR="${arg#--dir=}" ;;
    *) echo "Argumento desconhecido: $arg" >&2; exit 2 ;;
  esac
done

do_or_show() {
  echo "+ $*"
  if [ "$APPLY" -eq 1 ]; then
    "$@"
  fi
}

echo "Mercado do Vale VPS abuse containment"
if [ "$APPLY" -eq 1 ]; then
  echo "MODO APLICAR: comandos destrutivos serao executados."
  mkdir -p "$BACKUP_DIR"
else
  echo "MODO DRY-RUN: nenhum processo/arquivo/servico sera alterado."
  echo "Use --apply somente depois de salvar a auditoria e confirmar os alvos."
fi
echo "Padrao suspeito: $TARGET_PATTERN"
echo "Diretorio suspeito: $TARGET_DIR"

echo
echo "Processos suspeitos atuais:"
ps auxww | grep -Ei "$TARGET_PATTERN" | grep -v grep || true

echo
echo "Cron root atual com linhas suspeitas:"
crontab -l 2>/dev/null | grep -Ein "$TARGET_PATTERN" || true

echo
echo "Arquivos suspeitos encontrados:"
find /tmp /var/tmp /dev/shm /root /home /opt /var/www -xdev -type f 2>/dev/null \
  | grep -Ei "$TARGET_PATTERN" \
  | head -200 || true
[ -d "$TARGET_DIR" ] && find "$TARGET_DIR" -maxdepth 4 -ls 2>/dev/null || true

if [ "$APPLY" -eq 1 ]; then
  echo
  echo "Backup em: $BACKUP_DIR"
  crontab -l > "$BACKUP_DIR/root-crontab.before" 2>/dev/null || true
  ps auxww > "$BACKUP_DIR/processes.before" || true
  systemctl list-units --all --no-pager > "$BACKUP_DIR/systemd-units.before" 2>/dev/null || true
fi

echo
echo "Remocao de persistencia no crontab root:"
if crontab -l >/tmp/mdv-root-crontab-current 2>/dev/null; then
  grep -Eiv "$TARGET_PATTERN" /tmp/mdv-root-crontab-current > /tmp/mdv-root-crontab-clean || true
  if [ "$APPLY" -eq 1 ]; then
    cp /tmp/mdv-root-crontab-clean "$BACKUP_DIR/root-crontab.after"
  fi
  do_or_show crontab /tmp/mdv-root-crontab-clean
else
  echo "Sem crontab root ou sem permissao para ler."
fi

if [ -n "$TARGET_PID" ]; then
  echo
  echo "PID alvo: $TARGET_PID"
  ps -o pid,ppid,user,group,lstart,etime,pcpu,pmem,args -p "$TARGET_PID" || true
  readlink -f "/proc/$TARGET_PID/exe" 2>/dev/null || true
  readlink -f "/proc/$TARGET_PID/cwd" 2>/dev/null || true
  do_or_show kill "$TARGET_PID"
  sleep 2
  if kill -0 "$TARGET_PID" 2>/dev/null; then
    do_or_show kill -9 "$TARGET_PID"
  fi
fi

echo
echo "Encerrando processos que casam com o padrao suspeito:"
for p in $(pgrep -f "$TARGET_PATTERN" 2>/dev/null || true); do
  [ "$p" = "$$" ] && continue
  ps -o pid,ppid,user,lstart,args -p "$p" || true
  do_or_show kill "$p"
done
sleep 2
for p in $(pgrep -f "$TARGET_PATTERN" 2>/dev/null || true); do
  [ "$p" = "$$" ] && continue
  do_or_show kill -9 "$p"
done

if [ -n "$TARGET_SERVICE" ]; then
  echo
  echo "Servico alvo: $TARGET_SERVICE"
  systemctl status "$TARGET_SERVICE" --no-pager || true
  do_or_show systemctl disable --now "$TARGET_SERVICE"
fi

if [ -n "$TARGET_CONTAINER" ]; then
  echo
  echo "Container alvo: $TARGET_CONTAINER"
  docker inspect "$TARGET_CONTAINER" >/tmp/mdv-container-inspect.json 2>/dev/null || true
  do_or_show docker stop "$TARGET_CONTAINER"
  do_or_show docker update --restart=no "$TARGET_CONTAINER"
fi

echo
echo "Quarentena de arquivos suspeitos encontrados por padrao:"
while IFS= read -r suspicious_file; do
  [ -z "$suspicious_file" ] && continue
  [ ! -e "$suspicious_file" ] && continue
  ls -la "$suspicious_file" 2>/dev/null || true
  sha256sum "$suspicious_file" 2>/dev/null || true
  quarantine_path="${suspicious_file}.quarantine-$(date +%Y%m%d-%H%M%S)"
  do_or_show chmod 000 "$suspicious_file"
  do_or_show mv "$suspicious_file" "$quarantine_path"
done < <(find /tmp /var/tmp /dev/shm /root /home /opt /var/www -xdev -type f 2>/dev/null | grep -Ei "$TARGET_PATTERN" | head -200 || true)

if [ -d "$TARGET_DIR" ]; then
  echo
  echo "Quarentena do diretorio suspeito: $TARGET_DIR"
  find "$TARGET_DIR" -maxdepth 4 -type f -exec sha256sum {} \; > "${BACKUP_DIR:-/tmp}/target-dir-files.sha256" 2>/dev/null || true
  quarantine_dir="${TARGET_DIR}.quarantine-$(date +%Y%m%d-%H%M%S)"
  do_or_show chmod -R 000 "$TARGET_DIR"
  do_or_show mv "$TARGET_DIR" "$quarantine_dir"
fi

if [ -n "$TARGET_PATH" ]; then
  echo
  echo "Arquivo alvo: $TARGET_PATH"
  ls -la "$TARGET_PATH" 2>/dev/null || true
  file "$TARGET_PATH" 2>/dev/null || true
  sha256sum "$TARGET_PATH" 2>/dev/null || true
  do_or_show chmod 000 "$TARGET_PATH"
  do_or_show mv "$TARGET_PATH" "${TARGET_PATH}.quarantine-$(date +%Y%m%d-%H%M%S)"
fi

echo
echo "Checagem pos-contencao:"
ps auxww | grep -Ei "$TARGET_PATTERN" | grep -v grep || true
crontab -l 2>/dev/null | grep -Ein "$TARGET_PATTERN" || true
