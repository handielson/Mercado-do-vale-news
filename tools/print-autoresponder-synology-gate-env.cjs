#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_EVIDENCE = path.join(ROOT, 'docs', 'operacional', 'autoresponder-synology-manual-evidence.example.json');

const REQUIRED_ENVS = [
  'AUTORESPONDER_SYNOLOGY_RAM_SWAP_OK',
  'AUTORESPONDER_SYNOLOGY_TUNNEL_OK',
  'AUTORESPONDER_SYNOLOGY_DSM_API_OK',
  'AUTORESPONDER_SYNOLOGY_LEGACY_TOKEN_ABSENT',
];

const CANONICAL_TUNNEL = {
  name: 'mdv-videos',
  uuid: '7680ed44-a7a9-4700-a37e-2026b3653360',
};

const FORBIDDEN_ACTIONS = [
  'print_only: commands are printed but not executed',
  'read_only: no files are written',
  'does_not_set_env',
  'does_not_touch_synology',
  'does not restart tunnel',
  'does not alter crontab',
  'does not restart processes',
  'does not enable log cleanup',
];

function resolveEvidencePath() {
  const input = process.argv[2] || DEFAULT_EVIDENCE;
  return path.isAbsolute(input) ? input : path.join(ROOT, input);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing manual evidence file: ${path.relative(ROOT, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validateEvidence(evidence) {
  const checks = Array.isArray(evidence.checks) ? evidence.checks : [];
  const missingConfirmations = REQUIRED_ENVS
    .map((env) => {
      const check = checks.find((item) => item && item.env === env);
      const evidenceText = check && typeof check.evidence === 'string' ? check.evidence.trim() : '';
      const confirmed = Boolean(check && check.confirmed === true && evidenceText.length > 0);
      return confirmed ? null : { env, reason: check ? 'missing confirmed=true or evidence text' : 'missing check entry' };
    })
    .filter(Boolean);

  const documentFailures = [];
  if (evidence.source_of_truth !== 'Synology.md') {
    documentFailures.push('source_of_truth must be Synology.md');
  }
  if (!evidence.canonical_tunnel || evidence.canonical_tunnel.name !== CANONICAL_TUNNEL.name) {
    documentFailures.push(`canonical_tunnel.name must be ${CANONICAL_TUNNEL.name}`);
  }
  if (!evidence.canonical_tunnel || evidence.canonical_tunnel.uuid !== CANONICAL_TUNNEL.uuid) {
    documentFailures.push(`canonical_tunnel.uuid must be ${CANONICAL_TUNNEL.uuid}`);
  }

  return { missingConfirmations, documentFailures };
}

function main() {
  const evidencePath = resolveEvidencePath();
  const evidence = readJson(evidencePath);
  const { missingConfirmations, documentFailures } = validateEvidence(evidence);
  const ok = missingConfirmations.length === 0 && documentFailures.length === 0;
  const powershell = REQUIRED_ENVS.map((env) => `$env:${env}="1"`);

  console.log(JSON.stringify({
    ok,
    print_only: true,
    read_only: true,
    does_not_set_env: true,
    does_not_touch_synology: true,
    shell: 'PowerShell',
    evidence_path: path.relative(ROOT, evidencePath),
    canonical_tunnel: CANONICAL_TUNNEL,
    missing_confirmations: missingConfirmations,
    document_failures: documentFailures,
    commands: ok ? powershell : [],
    next_safe_step: ok
      ? 'Review the printed PowerShell commands, set them in the current shell, then run the safety gate locally.'
      : 'Keep the safety gate blocked and complete the missing manual evidence.',
    forbidden_actions: FORBIDDEN_ACTIONS,
  }, null, 2));

  if (!ok) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    print_only: true,
    read_only: true,
    does_not_set_env: true,
    does_not_touch_synology: true,
    error: error.message,
    forbidden_actions: FORBIDDEN_ACTIONS,
  }, null, 2));
  process.exitCode = 1;
}
