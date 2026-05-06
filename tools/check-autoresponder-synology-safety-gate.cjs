#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SYNOLOGY_DOC = path.join(ROOT, 'Synology.md');
const READINESS_DOC = path.join(ROOT, 'docs', 'operacional', '2026-05-05-autoresponder-synology-readiness.md');

const CANONICAL_TUNNEL = {
  name: 'mdv-videos',
  uuid: '7680ed44-a7a9-4700-a37e-2026b3653360',
};

const REQUIRED_CONFIRMATIONS = [
  {
    env: 'AUTORESPONDER_SYNOLOGY_RAM_SWAP_OK',
    label: 'RAM/swap checked before any NAS or tunnel action',
  },
  {
    env: 'AUTORESPONDER_SYNOLOGY_TUNNEL_OK',
    label: 'canonical tunnel health checked',
  },
  {
    env: 'AUTORESPONDER_SYNOLOGY_DSM_API_OK',
    label: 'DSM API query checked',
  },
  {
    env: 'AUTORESPONDER_SYNOLOGY_LEGACY_TOKEN_ABSENT',
    label: 'legacy --token process checked as absent',
  },
];

const FORBIDDEN_ACTIONS = [
  'read_only: this gate never changes the Synology NAS',
  'do not restart the Cloudflare tunnel from this gate',
  'do not change DNS from this gate',
  'do not change scheduled jobs from this gate',
  'do not restart application processes from this gate',
  'do not enable log cleanup from this gate',
];

function readFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${path.relative(ROOT, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function isConfirmed(name) {
  return process.env[name] === '1';
}

function main() {
  const synologyDoc = readFile(SYNOLOGY_DOC);
  const readinessDoc = readFile(READINESS_DOC);

  const documentChecks = [
    {
      name: 'source_of_truth_mentions_canonical_tunnel',
      ok: synologyDoc.includes(CANONICAL_TUNNEL.name) && synologyDoc.includes(CANONICAL_TUNNEL.uuid),
    },
    {
      name: 'readiness_phase_is_read_only',
      ok: readinessDoc.includes('read-only') && readinessDoc.includes('não altera o Synology'),
    },
  ];

  const missingConfirmations = REQUIRED_CONFIRMATIONS
    .filter((confirmation) => !isConfirmed(confirmation.env))
    .map((confirmation) => ({
      env: confirmation.env,
      label: confirmation.label,
      expected: '1',
    }));

  const failedDocumentChecks = documentChecks.filter((check) => !check.ok);
  const blocked = missingConfirmations.length > 0 || failedDocumentChecks.length > 0;

  console.log(JSON.stringify({
    ok: !blocked,
    blocked,
    read_only: true,
    source_of_truth: 'Synology.md',
    canonical_tunnel: CANONICAL_TUNNEL,
    required_confirmations: REQUIRED_CONFIRMATIONS,
    missing_confirmations: missingConfirmations,
    document_checks: documentChecks,
    failed_document_checks: failedDocumentChecks,
    next_step_when_blocked: 'Do not write to the final Synology archive path until every manual confirmation is checked.',
    forbidden_actions: FORBIDDEN_ACTIONS,
  }, null, 2));

  if (blocked) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    blocked: true,
    read_only: true,
    error: error.message,
    forbidden_actions: FORBIDDEN_ACTIONS,
  }, null, 2));
  process.exitCode = 1;
}
