#!/usr/bin/env bash
set -u

OUT_DIR="${1:-/tmp/mdv-vps-abuse-audit-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT_DIR"

run() {
  local name="$1"
  shift
  {
    echo "### $name"
    echo "\$ $*"
    "$@"
  } > "$OUT_DIR/$name.txt" 2>&1 || true
}

run_shell() {
  local name="$1"
  local script="$2"
  {
    echo "### $name"
    echo "\$ $script"
    bash -lc "$script"
  } > "$OUT_DIR/$name.txt" 2>&1 || true
}

echo "Mercado do Vale VPS abuse audit"
echo "Output: $OUT_DIR"
echo "Started: $(date -Is)" > "$OUT_DIR/README.txt"

run system-date date
run uptime uptime
run current-users who
run login-history last -a
run process-top ps auxww --sort=-%cpu
run process-tree ps axjfww
run network-listeners ss -tulpn
run network-connections ss -tunap
run disk-usage df -h
run memory free -m

run_shell suspicious-processes "ps auxww | grep -Ei 'systemd-bench|bench\\.json|xmrig|miner|kdevtmpfsi|kinsing|watchdog|masscan|zgrab|cryptonight' | grep -v grep"
run_shell suspicious-proc-details "for p in \$(pgrep -f 'systemd-bench|bench\\.json|xmrig|miner|kdevtmpfsi|kinsing|watchdog|masscan|zgrab|cryptonight' 2>/dev/null); do echo '=== PID' \$p '==='; ps -o pid,ppid,user,group,lstart,etime,pcpu,pmem,args -p \$p; echo 'exe:'; readlink -f /proc/\$p/exe 2>/dev/null || true; echo 'cwd:'; readlink -f /proc/\$p/cwd 2>/dev/null || true; echo 'root:'; readlink -f /proc/\$p/root 2>/dev/null || true; echo 'environ:'; tr '\\0' '\\n' < /proc/\$p/environ 2>/dev/null | sed -n '1,80p'; echo 'open files:'; ls -la /proc/\$p/fd 2>/dev/null | sed -n '1,120p'; echo; done"
run_shell suspicious-parent-chain "for p in \$(pgrep -f 'systemd-bench|bench\\.json|xmrig|miner|kdevtmpfsi|kinsing|watchdog|masscan|zgrab|cryptonight' 2>/dev/null); do echo '=== PID chain for' \$p '==='; cur=\$p; while [ -n \"\$cur\" ] && [ \"\$cur\" != 0 ]; do ps -o pid,ppid,user,lstart,args -p \$cur --no-headers; cur=\$(ps -o ppid= -p \$cur 2>/dev/null | tr -d ' '); done; echo; done"
run_shell suspicious-files "find /tmp /var/tmp /dev/shm /root /home /opt /var/www -xdev \\( -name 'systemd-bench' -o -name '.bench.json' -o -name '*xmrig*' -o -name '*kinsing*' -o -name '*kdevtmpfsi*' \\) -ls 2>/dev/null"
run_shell suspicious-recent-files "find /tmp /var/tmp /dev/shm /root /home /opt /var/www -xdev -type f -mtime -10 -ls 2>/dev/null | head -500"

run_shell cron-root "crontab -l"
run_shell cron-system "ls -la /etc/cron* /var/spool/cron /var/spool/cron/crontabs 2>/dev/null"
run_shell cron-content "grep -RIn --exclude-dir='*.dpkg-*' . /etc/cron* /var/spool/cron /var/spool/cron/crontabs 2>/dev/null | head -500"

run_shell systemd-running "systemctl list-units --type=service --state=running --no-pager"
run_shell systemd-enabled "systemctl list-unit-files --type=service --state=enabled --no-pager"
run_shell systemd-timers "systemctl list-timers --all --no-pager"
run_shell systemd-suspicious "systemctl list-units --all --no-pager | grep -Ei 'bench|miner|xmrig|kinsing|kdev|watchdog' || true"

run_shell docker-ps "command -v docker >/dev/null && docker ps -a || true"
run_shell docker-images "command -v docker >/dev/null && docker images || true"
run_shell docker-stats "command -v docker >/dev/null && docker stats --no-stream || true"
run_shell docker-events "command -v docker >/dev/null && docker events --since 72h --until 0s 2>/dev/null | tail -300 || true"

run_shell sshd-config "grep -RIn 'PermitRootLogin\\|PasswordAuthentication\\|AuthorizedKeysFile' /etc/ssh/sshd_config /etc/ssh/sshd_config.d 2>/dev/null"
run_shell authorized-keys "find /root /home -path '*/.ssh/authorized_keys' -type f -maxdepth 4 -print -exec sed -n '1,120p' {} \\; 2>/dev/null"
run_shell users "getent passwd; echo; getent group sudo; getent group wheel"
run_shell sudoers "grep -RIn . /etc/sudoers /etc/sudoers.d 2>/dev/null"

run_shell auth-log "grep -R 'Accepted password\\|Accepted publickey\\|Failed password\\|Invalid user\\|session opened' /var/log/auth.log* /var/log/secure* 2>/dev/null | tail -500"
run_shell journal-recent "journalctl -S '2026-06-10' --no-pager | tail -1000"
run_shell nginx-interesting "grep -R 'POST /api/vps-proxy\\|/api/shipping\\|password-reset\\|/delivery/jobs' /var/log/nginx /var/log 2>/dev/null | tail -500"

run_shell package-updates "command -v apt >/dev/null && apt list --upgradable 2>/dev/null || true"
run_shell firewall "ufw status verbose 2>/dev/null || true; iptables -S 2>/dev/null || true"

{
  echo "Finished: $(date -Is)"
  echo
  echo "Next step: copy ${OUT_DIR}.tar.gz before changing the server."
} >> "$OUT_DIR/README.txt"

tar -czf "${OUT_DIR}.tar.gz" -C "$(dirname "$OUT_DIR")" "$(basename "$OUT_DIR")" 2>/dev/null || true
sha256sum "${OUT_DIR}.tar.gz" > "${OUT_DIR}.tar.gz.sha256" 2>/dev/null || true

echo "Audit finished: $OUT_DIR"
echo "Archive: ${OUT_DIR}.tar.gz"
