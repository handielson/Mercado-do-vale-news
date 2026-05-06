const { Client } = require('ssh2');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const deploySource = fs.readFileSync(path.join(root, 'deploy.cjs'), 'utf8');
const localEnvPath = path.join(root, '.env.local');
const remoteEnvPath = '/var/www/mdv-api/.env';

function readConst(name) {
  const match = deploySource.match(new RegExp(`const ${name} = '([^']+)';`));
  if (!match) throw new Error(`Missing ${name} in deploy.cjs`);
  return match[1];
}

function setEnvValue(text, key, value) {
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(text)) return text.replace(pattern, line);
  return `${text.replace(/\s*$/, '')}\n${line}\n`;
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
  const token = crypto.randomBytes(32).toString('hex');
  const localText = fs.existsSync(localEnvPath) ? fs.readFileSync(localEnvPath, 'utf8') : '';
  fs.writeFileSync(localEnvPath, setEnvValue(localText, 'AUTORESPONDER_TOKEN', token));

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

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const remoteBackup = `/var/www/mdv-api/.codex-backups/.env.${stamp}.bak`;
  await exec(conn, 'mkdir -p /var/www/mdv-api/.codex-backups');
  await exec(conn, `cp ${remoteEnvPath} ${remoteBackup}`);

  await withSftp(conn, async (sftp) => {
    const remoteText = await readRemoteFile(sftp, remoteEnvPath);
    await writeRemoteFile(sftp, remoteEnvPath, setEnvValue(remoteText, 'AUTORESPONDER_TOKEN', token));
  });

  await exec(conn, 'pm2 restart mdv-api --update-env');
  conn.end();

  console.log(JSON.stringify({
    ok: true,
    token_written_to_local_env: '.env.local',
    token_written_to_remote_env: remoteEnvPath,
    remote_backup: remoteBackup,
    token_chars: token.length,
    token_preview: `${token.slice(0, 6)}...${token.slice(-4)}`,
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
