#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { Client } = require('ssh2');
const { assertNoSupabaseRuntime } = require('./assert-no-supabase-runtime.cjs');

const ROOT = path.resolve(__dirname, '..');

function getEnvRoots() {
  const roots = [ROOT];
  const parts = ROOT.split(path.sep);
  const worktreesIndex = parts.lastIndexOf('.worktrees');
  if (worktreesIndex > 0) {
    const mainRoot = parts.slice(0, worktreesIndex).join(path.sep);
    roots.push(mainRoot);
  }
  return Array.from(new Set(roots));
}

try {
  for (const envRoot of getEnvRoots()) {
    require('dotenv').config({ path: path.join(envRoot, '.env.vps.local') });
    require('dotenv').config({ path: path.join(envRoot, '.env.local') });
    require('dotenv').config({ path: path.join(envRoot, '.env') });
    require('dotenv').config({ path: path.join(envRoot, '.env.production') });
  }
} catch (_) {
  // dotenv is optional for CI environments that inject variables directly.
}

const DIST_DIR = path.join(ROOT, 'dist');

const config = {
  host: process.env.VPS_SITE_HOST,
  port: Number(process.env.VPS_SITE_PORT || 22),
  username: process.env.VPS_SITE_USER,
  password: process.env.VPS_SITE_PASSWORD,
  privateKey: process.env.VPS_SITE_PRIVATE_KEY ? fs.readFileSync(process.env.VPS_SITE_PRIVATE_KEY) : undefined,
  root: (process.env.VPS_SITE_ROOT || '/var/www/mdv-site').replace(/\/+$/, ''),
};

function requireConfig() {
  const missing = [];
  if (!config.host) missing.push('VPS_SITE_HOST');
  if (!config.username) missing.push('VPS_SITE_USER');
  if (!config.password && !config.privateKey) missing.push('VPS_SITE_PASSWORD or VPS_SITE_PRIVATE_KEY');
  if (!config.root) missing.push('VPS_SITE_ROOT');
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function walkFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (['node_modules', 'dist', '.git', '.worktrees'].includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
      continue;
    }
    if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function assertBuiltBundleSafety() {
  const assetsDir = path.join(DIST_DIR, 'assets');
  const jsFiles = walkFiles(assetsDir).filter((file) => file.endsWith('.js'));
  const offenders = jsFiles.filter((file) =>
    fs.readFileSync(file, 'utf8').includes('Missing Supabase environment variables')
  );

  if (offenders.length) {
    throw new Error(
      [
        'Deploy bloqueado: o bundle contem "Missing Supabase environment variables".',
        ...offenders.slice(0, 5).map((file) => `- ${path.relative(ROOT, file).replace(/\\/g, '/')}`),
      ].join('\n')
    );
  }
}

function runLocalBuild() {
  assertNoSupabaseRuntime();

  if (process.env.VPS_SITE_SKIP_BUILD === '1') {
    console.log('Skipping npm run build because VPS_SITE_SKIP_BUILD=1');
    if (!fs.existsSync(DIST_DIR)) {
      throw new Error(`Build output not found: ${DIST_DIR}`);
    }
    assertBuiltBundleSafety();
    return;
  }

  console.log('Running npm run build...');
  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'npm.cmd run build' : 'npm';
  const args = isWindows ? [] : ['run', 'build'];
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) {
    throw new Error(`npm run build failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const suffix = result.signal ? `, signal ${result.signal}` : '';
    throw new Error(`npm run build failed with exit code ${result.status}${suffix}`);
  }
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error(`Build output not found: ${DIST_DIR}`);
  }
  assertBuiltBundleSafety();
}

function execRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', chunk => { stdout += chunk.toString(); });
      stream.stderr.on('data', chunk => { stderr += chunk.toString(); });
      stream.on('close', code => {
        if (code !== 0) {
          reject(new Error(`Remote command failed (${code}): ${command}\n${stderr || stdout}`));
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  });
}

function connect() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => resolve(conn));
    conn.on('error', reject);
    conn.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      privateKey: config.privateKey,
    });
  });
}

function openSftp(conn) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) reject(err);
      else resolve(sftp);
    });
  });
}

function mkdirRemote(sftp, remoteDir) {
  return new Promise((resolve, reject) => {
    sftp.mkdir(remoteDir, { mode: 0o755 }, err => {
      if (!err || err.code === 4) resolve();
      else reject(err);
    });
  });
}

async function ensureRemoteDir(sftp, remoteDir) {
  const normalized = remoteDir.replace(/\/+$/, '');
  const parts = normalized.split('/').filter(Boolean);
  let current = normalized.startsWith('/') ? '' : '.';
  for (const part of parts) {
    current = current === '' ? `/${part}` : `${current}/${part}`;
    await mkdirRemote(sftp, current);
  }
}

function uploadFile(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(localPath, remotePath, err => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function uploadDirectory(sftp, localDir, remoteDir) {
  await ensureRemoteDir(sftp, remoteDir);
  const entries = fs.readdirSync(localDir, { withFileTypes: true });
  for (const entry of entries) {
    const localPath = path.join(localDir, entry.name);
    const remotePath = `${remoteDir}/${entry.name}`;
    if (entry.isDirectory()) {
      await uploadDirectory(sftp, localPath, remotePath);
      continue;
    }
    if (entry.isFile()) {
      await uploadFile(sftp, localPath, remotePath);
      console.log(`Uploaded ${path.relative(DIST_DIR, localPath).replace(/\\/g, '/')}`);
    }
  }
}

function buildReleaseName() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
}

async function main() {
  requireConfig();
  runLocalBuild();

  const releaseName = buildReleaseName();
  const releasesDir = `${config.root}/releases`;
  const releaseDir = `${releasesDir}/${releaseName}`;
  const currentLink = `${config.root}/current`;
  const previousLink = `${config.root}/previous`;

  const conn = await connect();
  try {
    console.log(`Connected to ${config.host}. Preparing ${releaseDir}`);
    await execRemote(conn, `mkdir -p ${shellQuote(releaseDir)}`);
    const sftp = await openSftp(conn);
    try {
      await uploadDirectory(sftp, DIST_DIR, releaseDir);
    } finally {
      sftp.end();
    }

    const switchCommand = [
      `mkdir -p ${shellQuote(releasesDir)}`,
      `if [ -L ${shellQuote(currentLink)} ]; then OLD_TARGET=$(readlink -f ${shellQuote(currentLink)} || true); if [ -n "$OLD_TARGET" ] && [ "$OLD_TARGET" != ${shellQuote(previousLink)} ]; then ln -sfn "$OLD_TARGET" ${shellQuote(previousLink)}; fi; fi`,
      `ln -sfn ${shellQuote(releaseDir)} ${shellQuote(currentLink)}`,
    ].join(' && ');

    await execRemote(conn, switchCommand);
    console.log(`Site release active: ${releaseDir}`);
    console.log(`Nginx root should point to: ${currentLink}`);
    console.log(`rollback: ssh ${config.username}@${config.host} "ln -sfn ${previousLink} ${currentLink}"`);
  } finally {
    conn.end();
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
