#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const PACKAGE_DIR = path.join(ROOT, 'reports', 'autoresponder-archive-vps-package');

const FILES = [
  'cron/archive-autoresponder-logs.cjs',
  'cron/archive-autoresponder-logs.sh',
  'docs/operacional/2026-05-05-autoresponder-archive-vps-dry-run.md',
];

function checksum(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function copyPackageFile(relativePath) {
  const source = path.join(ROOT, relativePath);
  const destination = path.join(PACKAGE_DIR, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing package source: ${relativePath}`);
  }
  await fs.promises.mkdir(path.dirname(destination), { recursive: true });
  await fs.promises.copyFile(source, destination);
  return {
    path: relativePath,
    bytes: fs.statSync(destination).size,
    sha256: checksum(destination),
  };
}

async function writeManifest(files) {
  const manifest = {
    name: 'autoresponder-archive-vps-package',
    generated_at: new Date().toISOString(),
    target_base: '/var/www/mdv-api',
    files,
    install_notes: [
      'Copy cron/archive-autoresponder-logs.cjs to /var/www/mdv-api/cron/archive-autoresponder-logs.cjs',
      'Copy cron/archive-autoresponder-logs.sh to /var/www/mdv-api/cron/archive-autoresponder-logs.sh',
      'Run chmod +x /var/www/mdv-api/cron/archive-autoresponder-logs.sh',
      'Validate with AUTORESPONDER_ARCHIVE_DRY_RUN=1 before enabling crontab',
    ],
  };
  const manifestPath = path.join(PACKAGE_DIR, 'manifest.json');
  await fs.promises.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

async function main() {
  await fs.promises.rm(PACKAGE_DIR, { recursive: true, force: true });
  await fs.promises.mkdir(PACKAGE_DIR, { recursive: true });
  const files = [];
  for (const relativePath of FILES) {
    files.push(await copyPackageFile(relativePath));
  }
  const manifest = await writeManifest(files);
  console.log(JSON.stringify({ ok: true, package_dir: PACKAGE_DIR, files: manifest.files }, null, 2));
}

main().catch((err) => {
  console.error('[prepare-autoresponder-archive-vps-package] failed:', err);
  process.exitCode = 1;
});
