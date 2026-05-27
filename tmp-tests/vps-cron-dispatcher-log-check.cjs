const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { readLegacyVpsConst: readConst } = require('./vps-ssh-config.cjs');

const WRAPPER = '/var/www/mdv-api/cron/cron-dispatcher.sh';
const LOG_PATH = '/var/log/mdv-cron-dispatcher.log';


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

function redact(text) {
  return String(text || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/(CRON_SECRET=)[^\s'"]+/gi, '$1[REDACTED]')
    .replace(/(Authorization:\s*)[^\r\n]+/gi, '$1[REDACTED]');
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

  const command = `
set -eu
printf 'crontab_has_entry='
crontab -l 2>/dev/null | grep -F '${WRAPPER}' >/dev/null && printf 'true\\n' || printf 'false\\n'
printf 'log_exists='
test -f '${LOG_PATH}' && printf 'true\\n' || printf 'false\\n'
if [ -f '${LOG_PATH}' ]; then
  printf 'log_meta='
  stat -c '%s bytes|%y' '${LOG_PATH}'
  printf 'last_lines_start\\n'
  tail -n 80 '${LOG_PATH}'
  printf '\\nlast_lines_end\\n'
fi
`;

  const result = await exec(conn, command);
  conn.end();

  const output = redact(result.stdout);
  const lines = output.split(/\r?\n/);
  const meta = {};
  const lastLines = [];
  let inTail = false;

  for (const line of lines) {
    if (line === 'last_lines_start') {
      inTail = true;
      continue;
    }
    if (line === 'last_lines_end') {
      inTail = false;
      continue;
    }
    if (inTail) {
      if (line.trim()) lastLines.push(line);
      continue;
    }
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) meta[match[1]] = match[2];
  }

  console.log(JSON.stringify({
    ok: true,
    crontab_has_entry: meta.crontab_has_entry === 'true',
    log_exists: meta.log_exists === 'true',
    log_meta: meta.log_meta || null,
    last_line_count: lastLines.length,
    last_lines: lastLines.slice(-20),
    note: 'Output redacts Authorization and CRON_SECRET patterns and does not read the VPS env file.',
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
