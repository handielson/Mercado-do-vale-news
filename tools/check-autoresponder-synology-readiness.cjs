#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SYNOLOGY_DOC = path.join(ROOT, 'Synology.md');
const BOT_DOC = path.join(ROOT, 'Bot_Whatsapp.md');
const ARCHIVE_SCRIPT = path.join(ROOT, 'cron', 'archive-autoresponder-logs.cjs');

const CANONICAL_TUNNEL = {
  name: 'mdv-videos',
  uuid: '7680ed44-a7a9-4700-a37e-2026b3653360',
};

const REQUIRED_HOSTNAMES = [
  'dsm-api.xiaomipetrolina.com.br',
  'imagens.xiaomipetrolina.com.br',
  'videos.mercadodovale.com.br',
];

const ARCHIVE_ROOT = '/volume1/backups/autoresponder';

const FORBIDDEN_ACTIONS = [
  'read_only: this preflight does not alter the Synology NAS',
  'ram_swap_first: check RAM and swap before any tunnel or DSM change',
  'do not restart tunnel from this phase',
  'do not alter DNS from this phase',
  'do not alter crontab from this phase',
  'do not enable log deletion from this phase',
];

function readRequiredFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${path.relative(ROOT, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function includesAll(source, values) {
  return values.map((value) => ({ value, ok: source.includes(value) }));
}

function main() {
  const synologyDoc = readRequiredFile(SYNOLOGY_DOC);
  const botDoc = readRequiredFile(BOT_DOC);
  const archiveScript = readRequiredFile(ARCHIVE_SCRIPT);

  const docChecks = [
    { name: 'canonical_tunnel_name', ok: synologyDoc.includes(CANONICAL_TUNNEL.name), expected: CANONICAL_TUNNEL.name },
    { name: 'canonical_tunnel_uuid', ok: synologyDoc.includes(CANONICAL_TUNNEL.uuid), expected: CANONICAL_TUNNEL.uuid },
    { name: 'ram_swap_warning', ok: /RAM|swap/i.test(synologyDoc), expected: 'RAM e swap before changes' },
    { name: 'legacy_token_warning', ok: synologyDoc.includes('--token'), expected: 'legacy token warning documented' },
    { name: 'archive_root_documented', ok: botDoc.includes(ARCHIVE_ROOT), expected: ARCHIVE_ROOT },
    { name: 'archive_env_supported', ok: archiveScript.includes('AUTORESPONDER_SYNOLOGY_ARCHIVE_DIR'), expected: 'AUTORESPONDER_SYNOLOGY_ARCHIVE_DIR' },
  ];

  const hostnameChecks = includesAll(synologyDoc, REQUIRED_HOSTNAMES).map((check) => ({
    name: `hostname:${check.value}`,
    ok: check.ok,
    expected: check.value,
  }));

  const checks = [...docChecks, ...hostnameChecks];
  const failed = checks.filter((check) => !check.ok);

  console.log(JSON.stringify({
    ok: failed.length === 0,
    read_only: true,
    source_of_truth: 'Synology.md',
    canonical_tunnel: CANONICAL_TUNNEL,
    required_hostnames: REQUIRED_HOSTNAMES,
    autoresponder_archive: {
      env: 'AUTORESPONDER_SYNOLOGY_ARCHIVE_DIR',
      target_root: ARCHIVE_ROOT,
      current_validation_level: 'local temp write only; final Synology destination not touched',
    },
    checks,
    failed,
    next_manual_checks_before_any_write: [
      'Check NAS RAM and swap in DSM Resource Monitor or /proc/meminfo',
      'Confirm dsm-api.xiaomipetrolina.com.br returns SYNO.API.Info success',
      'Confirm the Cloudflare tunnel shown for dsm-api/imagens/videos is mdv-videos',
      'Confirm there is no active legacy cloudflared process using --token',
      'Only after those checks, consider a controlled archive write to the real Synology path',
    ],
    forbidden_actions: FORBIDDEN_ACTIONS,
  }, null, 2));

  if (failed.length > 0) process.exitCode = 1;
}

main();
