const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const deploySource = fs.readFileSync(path.join(root, 'deploy.cjs'), 'utf8');
const APPLY = process.env.CRON_DISPATCHER_CRON_APPLY === '1' || process.argv.includes('--apply');
const WRAPPER = '/var/www/mdv-api/cron/cron-dispatcher.sh';
const SCHEDULE = process.env.CRON_DISPATCHER_CRON_SCHEDULE || '0 22 * * *';
const URL = process.env.CRON_DISPATCHER_URL || 'https://api.xiaomipetrolina.com.br/api/cron-dispatcher';

function readConst(name) {
  const match = deploySource.match(new RegExp(`const ${name} = '([^']+)';`));
  if (!match) throw new Error(`Missing ${name} in deploy.cjs`);
  return match[1];
}

function exec(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        if (code === 0) return resolve({ stdout, stderr, code });
        reject(new Error(stderr || stdout || `Command failed: ${command}`));
      });
      stream.on('data', (data) => {
        stdout += data.toString();
      });
      stream.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    });
  });
}

function withSftp(conn, fn) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      Promise.resolve(fn(sftp)).then(resolve, reject).finally(() => sftp.end());
    });
  });
}

function writeRemoteFile(sftp, remotePath, text) {
  return new Promise((resolve, reject) => {
    sftp.writeFile(remotePath, text, 'utf8', (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function wrapperText() {
  return `#!/bin/sh
set -eu

cd /var/www/mdv-api

if [ -f /var/www/mdv-api/.env ]; then
  set -a
  # shellcheck disable=SC1091
  . /var/www/mdv-api/.env
  set +a
fi

if [ -z "\${CRON_SECRET:-}" ]; then
  echo "cron-dispatcher aborted: CRON_SECRET missing" >&2
  exit 1
fi

curl -fsS \\
  -H "Authorization: Bearer \${CRON_SECRET}" \\
  "\${CRON_DISPATCHER_URL:-${URL}}"
`;
}

function installCommand() {
  const line = `${SCHEDULE} ${WRAPPER} >> /var/log/mdv-cron-dispatcher.log 2>&1`;
  return `
set -eu
tmp="$(mktemp)"
crontab -l 2>/dev/null | grep -v '${WRAPPER}' | grep -v '/api/cron-dispatcher' > "$tmp" || true
printf '%s\\n' '${line}' >> "$tmp"
crontab "$tmp"
rm -f "$tmp"
`;
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn
      .on('ready', resolve)
      .on('error', reject)
      .connect({
        host: readConst('VpsHost'),
        port: 22,
        username: readConst('VpsUser'),
        password: readConst('VpsPass'),
        readyTimeout: 15000,
      });
  });

  await exec(conn, 'mkdir -p /var/www/mdv-api/cron');
  await withSftp(conn, async (sftp) => {
    await writeRemoteFile(sftp, WRAPPER, wrapperText());
  });
  await exec(conn, `chmod +x ${WRAPPER}`);
  await exec(conn, `sh -n ${WRAPPER}`);
  const probeUrl = `${URL}?forceTemplateId=__codex_probe__`;
  const dryRun = await exec(conn, `CRON_DISPATCHER_URL='${probeUrl}' ${WRAPPER} >/tmp/mdv-cron-dispatcher.dry-run.out 2>/tmp/mdv-cron-dispatcher.dry-run.err && printf 'dry_run_ok\\n'`);
  const existingCrontab = await exec(conn, 'crontab -l 2>/dev/null || true');

  let installed = false;
  if (APPLY) {
    await exec(conn, installCommand());
    installed = true;
  }
  const afterCrontab = await exec(conn, 'crontab -l 2>/dev/null || true');
  conn.end();

  console.log(JSON.stringify({
    ok: true,
    apply: APPLY,
    installed,
    wrapper: WRAPPER,
    schedule: SCHEDULE,
    url: URL,
    dry_run_url_mode: 'forceTemplateId probe',
    dry_run: dryRun.stdout.trim(),
    had_existing_entry: existingCrontab.stdout.includes(WRAPPER),
    has_entry_now: afterCrontab.stdout.includes(WRAPPER),
    note: 'CRON_SECRET value was not printed',
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
