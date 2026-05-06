#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const ROOT = path.resolve(__dirname, '..');
const PACKAGE_RELATIVE_DIR = 'reports/autoresponder-archive-vps-package';
const PACKAGE_DIR = path.join(ROOT, PACKAGE_RELATIVE_DIR);
const MANIFEST_PATH = path.join(PACKAGE_DIR, 'manifest.json');
const TARGET_BASE = '/var/www/mdv-api';
const HOST = process.env.VPS_HOST || '76.13.232.162';
const USER = process.env.VPS_USER || 'root';
const PASS = process.env.VPS_ROOT_PASSWORD;
const APPLY = process.env.AUTORESPONDER_ARCHIVE_INSTALL_APPLY === '1';
const ARCHIVE_DATE = process.env.AUTORESPONDER_ARCHIVE_DATE || process.argv[2] || '';

const REMOTE_FILES = {
  'cron/archive-autoresponder-logs.cjs': `${TARGET_BASE}/cron/archive-autoresponder-logs.cjs`,
  'cron/archive-autoresponder-logs.sh': `${TARGET_BASE}/cron/archive-autoresponder-logs.sh`,
  'docs/operacional/2026-05-05-autoresponder-archive-vps-dry-run.md':
    `${TARGET_BASE}/docs/operacional/2026-05-05-autoresponder-archive-vps-dry-run.md`,
};

const FORBIDDEN_ACTIONS = [
  'crontab is not changed by this installer',
  'pm2 is not restarted by this installer',
  'delete mode is never enabled by this installer',
];

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Missing ${PACKAGE_RELATIVE_DIR}/manifest.json. Run node tools/prepare-autoresponder-archive-vps-package.cjs first.`);
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function execRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', (data) => {
        stdout += data.toString();
      });
      stream.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      stream.on('close', (code) => {
        if (code !== 0) {
          const detail = stderr.trim() || stdout.trim() || `exit ${code}`;
          reject(new Error(`Remote command failed: ${command}\n${detail}`));
          return;
        }
        resolve(stdout);
      });
    });
  });
}

function uploadFile(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const writeStream = sftp.createWriteStream(remotePath, { mode: 0o644 });
      writeStream.on('close', resolve);
      writeStream.on('error', reject);
      fs.createReadStream(localPath).on('error', reject).pipe(writeStream);
    });
  });
}

function connect() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => resolve(conn));
    conn.on('error', reject);
    conn.connect({ host: HOST, port: 22, username: USER, password: PASS });
  });
}

function printPlan(manifest) {
  console.log(JSON.stringify({
    ok: true,
    apply: false,
    host: HOST,
    user: USER,
    package_dir: PACKAGE_RELATIVE_DIR,
    target_base: TARGET_BASE,
    files: manifest.files.map((file) => ({
      source: `${PACKAGE_RELATIVE_DIR}/${file.path}`,
      target: REMOTE_FILES[file.path],
      sha256: file.sha256,
      bytes: file.bytes,
    })),
    remote_checks: [
      'mkdir -p /var/www/mdv-api/cron /var/www/mdv-api/docs/operacional',
      'sha256sum for every uploaded file',
      'chmod +x /var/www/mdv-api/cron/archive-autoresponder-logs.sh',
      'node --check /var/www/mdv-api/cron/archive-autoresponder-logs.cjs',
      'AUTORESPONDER_ARCHIVE_DRY_RUN=1 AUTORESPONDER_ARCHIVE_DELETE_ENABLED=0 node /var/www/mdv-api/cron/archive-autoresponder-logs.cjs',
    ],
    forbidden_actions: FORBIDDEN_ACTIONS,
    next: 'Set AUTORESPONDER_ARCHIVE_INSTALL_APPLY=1 and VPS_ROOT_PASSWORD to copy and validate on the VPS.',
  }, null, 2));
}

async function installAndValidate(manifest) {
  if (!PASS) {
    throw new Error('Missing VPS_ROOT_PASSWORD. Refusing to connect without an explicit runtime password.');
  }

  const conn = await connect();
  try {
    await execRemote(conn, 'mkdir -p /var/www/mdv-api/cron /var/www/mdv-api/docs/operacional');

    const uploaded = [];
    for (const file of manifest.files) {
      const remotePath = REMOTE_FILES[file.path];
      if (!remotePath) throw new Error(`Unexpected package file in manifest: ${file.path}`);
      const localPath = path.join(PACKAGE_DIR, file.path);
      await uploadFile(conn, localPath, remotePath);
      const remoteSha = (await execRemote(conn, `sha256sum ${shellQuote(remotePath)} | awk '{print $1}'`)).trim();
      if (remoteSha !== file.sha256) {
        throw new Error(`Remote checksum mismatch for ${file.path}: expected ${file.sha256}, got ${remoteSha}`);
      }
      uploaded.push({ path: file.path, remotePath, sha256: remoteSha });
    }

    await execRemote(conn, 'chmod +x /var/www/mdv-api/cron/archive-autoresponder-logs.sh');
    await execRemote(conn, 'node --check /var/www/mdv-api/cron/archive-autoresponder-logs.cjs');

    const archiveDateArg = ARCHIVE_DATE ? ` ${shellQuote(ARCHIVE_DATE)}` : '';
    const dryRunOutput = await execRemote(
      conn,
      `cd /var/www/mdv-api && AUTORESPONDER_ARCHIVE_DRY_RUN=1 AUTORESPONDER_ARCHIVE_DELETE_ENABLED=0 node /var/www/mdv-api/cron/archive-autoresponder-logs.cjs${archiveDateArg}`
    );

    console.log(JSON.stringify({
      ok: true,
      apply: true,
      host: HOST,
      target_base: TARGET_BASE,
      uploaded,
      chmod: true,
      node_check: true,
      dry_run_output: dryRunOutput.trim(),
      forbidden_actions: FORBIDDEN_ACTIONS,
    }, null, 2));
  } finally {
    conn.end();
  }
}

async function main() {
  const manifest = readManifest();
  if (!APPLY) {
    printPlan(manifest);
    return;
  }
  await installAndValidate(manifest);
}

main().catch((err) => {
  console.error('[install-autoresponder-archive-vps-dry-run] failed:', err.message);
  process.exitCode = 1;
});
