const { Client } = require('ssh2');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const deploySource = fs.readFileSync(path.join(root, 'deploy.cjs'), 'utf8');
const remoteEnvPath = '/var/www/mdv-api/.env';

function readConst(name) {
  const match = deploySource.match(new RegExp(`const ${name} = '([^']+)';`));
  if (!match) throw new Error(`Missing ${name} in deploy.cjs`);
  return match[1];
}

function parseEnvValue(text, key) {
  const line = text.split(/\r?\n/).find((entry) => entry.startsWith(`${key}=`));
  if (!line) return '';
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '');
}

function setEnvValue(text, key, value) {
  const safeValue = String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const line = `${key}="${safeValue}"`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(text)) return text.replace(pattern, line);
  return `${text.replace(/\s*$/, '')}\n${line}\n`;
}

function preserveExistingSecret(text, key) {
  const current = parseEnvValue(text, key);
  return current || crypto.randomBytes(32).toString('hex');
}

function exec(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        if (code === 0) return resolve({ stdout, stderr });
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
      Promise.resolve(fn(sftp))
        .then(resolve, reject)
        .finally(() => sftp.end());
    });
  });
}

function readRemoteFile(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.readFile(remotePath, 'utf8', (err, data) => {
      if (err) return reject(err);
      resolve(String(data));
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

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').substring(0, 14);
  const remoteBackup = `/var/www/mdv-api/.codex-backups/.env.${stamp}.bak`;
  await exec(conn, 'mkdir -p /var/www/mdv-api/.codex-backups');
  await exec(conn, `cp ${remoteEnvPath} ${remoteBackup}`);

  const result = await withSftp(conn, async (sftp) => {
    const before = await readRemoteFile(sftp, remoteEnvPath);
    const cronSecret = preserveExistingSecret(before, 'CRON_SECRET');
    const telegramSecret = preserveExistingSecret(before, 'TELEGRAM_WEBHOOK_SECRET');
    let after = setEnvValue(before, 'CRON_SECRET', cronSecret);
    after = setEnvValue(after, 'TELEGRAM_WEBHOOK_SECRET', telegramSecret);
    await writeRemoteFile(sftp, remoteEnvPath, after);
    return {
      CRON_SECRET: {
        changed: parseEnvValue(before, 'CRON_SECRET') !== cronSecret,
        secret_chars: cronSecret.length,
      },
      TELEGRAM_WEBHOOK_SECRET: {
        changed: parseEnvValue(before, 'TELEGRAM_WEBHOOK_SECRET') !== telegramSecret,
        secret_chars: telegramSecret.length,
      },
    };
  });

  await exec(conn, 'pm2 restart mdv-api --update-env');
  await exec(conn, 'pm2 describe mdv-api | grep -q "online"');
  conn.end();

  console.log(JSON.stringify({
    ok: true,
    remote_env: remoteEnvPath,
    remote_backup: remoteBackup,
    managed: result,
    note: 'values were not printed',
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
